import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { getStorageSettings } from '@/server/storage';

const storageSettingsSchema = z.object({
  driver: z.enum(['local', 'google-drive', 'backblaze']),
  googleDriveFolderId: z.string().trim().max(200).optional(),
});

const B2_ENV_VARS = ['B2_ENDPOINT', 'B2_REGION', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APPLICATION_KEY'] as const;

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const settings = await getStorageSettings();
    return Response.json(
      apiOk({
        ...settings,
        hasCredentials: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
        hasBackblazeCredentials: B2_ENV_VARS.every((k) => !!process.env[k]),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/documents/storage-settings failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    await authorize(session, 'settings:write');

    const body = await req.json().catch(() => ({}));
    const parsed = storageSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
    }
    const { driver, googleDriveFolderId } = parsed.data;

    if (driver === 'google-drive') {
      if (!googleDriveFolderId) {
        return Response.json(apiError('Google Drive folder ID is required'), { status: 422 });
      }
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        return Response.json(
          apiError(
            'GOOGLE_SERVICE_ACCOUNT_JSON env var is not set. Add your service account credentials before switching to Google Drive.',
          ),
          { status: 422 },
        );
      }
    }

    if (driver === 'backblaze') {
      const missing = B2_ENV_VARS.filter((k) => !process.env[k]);
      if (missing.length > 0) {
        return Response.json(
          apiError(`Backblaze B2 env vars not set: ${missing.join(', ')}. Add these before switching to Backblaze.`),
          { status: 422 },
        );
      }
    }

    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: 'storage.driver' },
        create: { key: 'storage.driver', value: driver },
        update: { value: driver },
      }),
      prisma.appSetting.upsert({
        where: { key: 'storage.googleDriveFolderId' },
        create: { key: 'storage.googleDriveFolderId', value: googleDriveFolderId ?? '' },
        update: { value: googleDriveFolderId ?? '' },
      }),
    ]);

    return Response.json(apiOk({ driver, googleDriveFolderId: googleDriveFolderId ?? '' }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/documents/storage-settings failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
