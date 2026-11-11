'use server';

import { revalidatePath } from 'next/cache';
import { bonusFormSchema, bonusApprovalSchema } from '../validators/bonus';
import { BonusService } from '../services/bonus.service';
import { getSession } from '@/server/auth/session';
function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}
import { BonusStatus } from '@prisma/client';

export async function createBonus(formData: unknown) {
  try {
    const session = await getSession();
    const validatedData = bonusFormSchema.parse(formData);
    const result = await BonusService.createBonus(session, validatedData);
    revalidatePath('/hr/bonus');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateBonus(id: string, formData: unknown) {
  try {
    const session = await getSession();
    const validatedData = bonusFormSchema.parse(formData);
    const result = await BonusService.updateBonus(session, id, validatedData);
    revalidatePath('/hr/bonus');
    revalidatePath(`/hr/bonus/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function processBonusApproval(id: string, formData: unknown) {
  try {
    const session = await getSession();
    const { status, remarks } = bonusApprovalSchema.parse(formData);
    const result = await BonusService.updateStatus(session, id, status as BonusStatus, remarks);
    revalidatePath('/hr/bonus');
    revalidatePath(`/hr/bonus/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function deleteBonus(id: string) {
  try {
    const session = await getSession();
    const result = await BonusService.deleteBonus(session, id);
    revalidatePath('/hr/bonus');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
