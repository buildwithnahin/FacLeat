'use server';

import { revalidatePath } from 'next/cache';
import { calculateSettlementSchema, approvalSettlementSchema, paymentSettlementSchema } from '../validators/final-settlement';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

function handleError(error: unknown): { success: false; error: string } {
  if (error instanceof BackendApiError) {
    return { success: false, error: error.message };
  }
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}

export async function calculateSettlementAction(
  formData: unknown,
): Promise<{ success: true; data: { id: string } } | { success: false; error: string }> {
  try {
    const { resignationId } = calculateSettlementSchema.parse(formData);
    const result = await backendFetch<{ id: string }>('/api/mobile/hr/final-settlement/calculate', {
      method: 'POST',
      body: JSON.stringify({ resignationId }),
    });
    revalidatePath('/hr/final-settlement');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function approveSettlementAction(
  id: string,
  formData: unknown,
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  try {
    const { level, status, remarks } = approvalSettlementSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/final-settlement/${id}/approval`, {
      method: 'POST',
      body: JSON.stringify({ level, status, remarks }),
    });
    revalidatePath('/hr/final-settlement');
    revalidatePath(`/hr/final-settlement/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function markSettlementPaidAction(
  id: string,
  formData: unknown,
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  try {
    const data = paymentSettlementSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/final-settlement/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    revalidatePath('/hr/final-settlement');
    revalidatePath(`/hr/final-settlement/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
