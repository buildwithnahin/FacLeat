import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const B2_PREFIX = 'b2:';

/**
 * Backblaze B2 storage driver, used via B2's S3-compatible API — this is
 * why `@aws-sdk/client-s3` is the dependency here rather than a
 * Backblaze-specific SDK. Production driver for Render, where the local
 * disk (localStorage's default) doesn't persist across deploys/restarts.
 * Configuration is env-var only (never DB-stored, unlike Google Drive's
 * folder ID) since B2_KEY_ID/B2_APPLICATION_KEY are secrets.
 */

let cachedClient: S3Client | null = null;

function getConfig() {
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const bucket = process.env.B2_BUCKET;
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  if (!endpoint || !region || !bucket || !keyId || !applicationKey) {
    throw new Error(
      'Backblaze B2 is not configured — set B2_ENDPOINT, B2_REGION, B2_BUCKET, B2_KEY_ID, and B2_APPLICATION_KEY.',
    );
  }
  return { endpoint, region, bucket, keyId, applicationKey };
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const { endpoint, region, keyId, applicationKey } = getConfig();
  cachedClient = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: keyId, secretAccessKey: applicationKey },
    // B2's S3-compatible endpoint expects virtual-hosted-style URLs, same
    // as real S3 — do not set forcePathStyle here.
  });
  return cachedClient;
}

function uniqueKey(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().slice(0, 12);
  const stem = randomBytes(16).toString('hex');
  const datePart = new Date().toISOString().slice(0, 10);
  return `${datePart}/${stem}${ext}`;
}

export const backblazeStorage = {
  async put(originalName: string, data: Buffer): Promise<{ storagePath: string }> {
    const { bucket } = getConfig();
    const client = getClient();
    const key = uniqueKey(originalName);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: 'application/octet-stream',
      }),
    );
    return { storagePath: `${B2_PREFIX}${key}` };
  },

  async get(storagePath: string): Promise<Buffer> {
    const { bucket } = getConfig();
    const client = getClient();
    const key = storagePath.slice(B2_PREFIX.length);
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Backblaze B2 returned no body for ${key}`);
    return Buffer.from(bytes);
  },

  async remove(storagePath: string): Promise<void> {
    const { bucket } = getConfig();
    const client = getClient();
    const key = storagePath.slice(B2_PREFIX.length);
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (status !== 404) throw error;
      // Already gone — nothing left to delete.
    }
  },

  async testConnection(): Promise<void> {
    const { bucket } = getConfig();
    const client = getClient();
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  },
};
