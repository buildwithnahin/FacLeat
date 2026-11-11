'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

const storageSettingsSchema = z.object({
  driver: z.enum(['local', 'google-drive']),
  googleDriveFolderId: z.string().trim().max(200).optional(),
});

export type StorageSettingsState =
  | { error?: string; success?: boolean }
  | undefined;

export async function saveStorageSettingsAction(
  _prev: StorageSettingsState,
  formData: FormData,
): Promise<StorageSettingsState> {
  const parsed = storageSettingsSchema.safeParse({
    driver: formData.get('driver'),
    googleDriveFolderId: formData.get('googleDriveFolderId') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }
  try {
    await backendFetch('/api/mobile/documents/storage-settings', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/documents/settings');
  return { success: true };
}

export async function testDriveConnectionAction(
  folderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await backendFetch<{ success: boolean; error?: string }>(
      '/api/mobile/documents/storage-settings/test-connection',
      { method: 'POST', body: JSON.stringify({ folderId }) },
    );
  } catch (e) {
    const msg = e instanceof BackendApiError ? e.message : 'Connection test failed';
    return { success: false, error: msg };
  }
}
