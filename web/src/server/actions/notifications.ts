'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

export async function markNotificationReadAction(id: string) {
  try {
    await backendFetch(`/api/mobile/notifications/${id}/read`, { method: 'POST' });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/notifications');
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  try {
    await backendFetch('/api/mobile/notifications/read-all', { method: 'POST' });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/notifications');
  return { success: true };
}
