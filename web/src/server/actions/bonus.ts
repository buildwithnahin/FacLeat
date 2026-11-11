'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { bonusFormSchema, bonusApprovalSchema } from '@/server/validators/bonus';

function handleError(error: unknown) {
  if (error instanceof BackendApiError) return { success: false as const, error: error.message };
  if (error instanceof Error) return { success: false as const, error: error.message };
  return { success: false as const, error: 'An unknown error occurred' };
}

export async function createBonus(formData: unknown) {
  try {
    const validatedData = bonusFormSchema.parse(formData);
    const result = await backendFetch('/api/mobile/hr/bonus', {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/bonus');
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateBonus(id: string, formData: unknown) {
  try {
    const validatedData = bonusFormSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/bonus/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/bonus');
    revalidatePath(`/hr/bonus/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function processBonusApproval(id: string, formData: unknown) {
  try {
    const validatedData = bonusApprovalSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/bonus/${id}/status`, {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/bonus');
    revalidatePath(`/hr/bonus/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteBonus(id: string) {
  try {
    const result = await backendFetch(`/api/mobile/hr/bonus/${id}`, { method: 'DELETE' });
    revalidatePath('/hr/bonus');
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}
