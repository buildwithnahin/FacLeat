'use server';

import { revalidatePath } from 'next/cache';
import { calculateSettlementSchema, approvalSettlementSchema, paymentSettlementSchema } from '../validators/final-settlement';
import { FinalSettlementService } from '../services/final-settlement.service';
import { getSession } from '@/server/auth/session';

function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}

export async function calculateSettlementAction(formData: unknown) {
  try {
    const session = await getSession();
    const { resignationId } = calculateSettlementSchema.parse(formData);
    const result = await FinalSettlementService.calculateSettlement(session, resignationId);
    revalidatePath('/hr/final-settlement');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function approveSettlementAction(id: string, formData: unknown) {
  try {
    const session = await getSession();
    const { level, status, remarks } = approvalSettlementSchema.parse(formData);
    const result = await FinalSettlementService.updateApproval(session, id, level, status, remarks);
    revalidatePath('/hr/final-settlement');
    revalidatePath(`/hr/final-settlement/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function markSettlementPaidAction(id: string, formData: unknown) {
  try {
    const session = await getSession();
    const data = paymentSettlementSchema.parse(formData);
    const result = await FinalSettlementService.markPaid(session, id, data);
    revalidatePath('/hr/final-settlement');
    revalidatePath(`/hr/final-settlement/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
