import 'server-only';
import { storagePut } from '@/server/storage';
import { ApiError } from '@/lib/errors';

const MAX_VOUCHER_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Shared by the accounts mobile routes that accept an optional receipt/voucher
 * photo (cash transfer, cash in, cash out) — mirrors the inline helper that
 * used to live in root's `server/actions/accounts.ts` `'use server'` file,
 * moved here since backend/'s route handlers (not server actions) are now
 * the ones parsing the multipart body.
 */
export async function storeVoucherImage(formData: FormData): Promise<string | undefined> {
  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.size > MAX_VOUCHER_IMAGE_BYTES) {
    throw new ApiError('Voucher image must be 2MB or smaller', 422);
  }
  if (!file.type.startsWith('image/')) {
    throw new ApiError('Voucher attachment must be an image', 422);
  }
  const { storagePath } = await storagePut(file.name, Buffer.from(await file.arrayBuffer()));
  return `/api/mobile/accounts/voucher-image?path=${encodeURIComponent(storagePath)}`;
}
