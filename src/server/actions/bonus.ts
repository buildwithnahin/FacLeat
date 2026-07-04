'use server';

import { revalidatePath } from 'next/cache';
import { bonusFormSchema, bonusApprovalSchema } from '../validators/bonus';
import { BonusService } from '../services/bonus.service';
function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}
import { BonusStatus } from '@prisma/client';

export async function createBonus(formData: unknown) {
  try {
    const validatedData = bonusFormSchema.parse(formData);
    const result = await BonusService.createBonus(validatedData);
    revalidatePath('/hr/bonus');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateBonus(id: string, formData: unknown) {
  try {
    const validatedData = bonusFormSchema.parse(formData);
    const result = await BonusService.updateBonus(id, validatedData);
    revalidatePath('/hr/bonus');
    revalidatePath(`/hr/bonus/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function processBonusApproval(id: string, formData: unknown) {
  try {
    const { status, remarks } = bonusApprovalSchema.parse(formData);
    const result = await BonusService.updateStatus(id, status as BonusStatus, remarks);
    revalidatePath('/hr/bonus');
    revalidatePath(`/hr/bonus/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteBonus(id: string) {
  try {
    const result = await BonusService.deleteBonus(id);
    revalidatePath('/hr/bonus');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
