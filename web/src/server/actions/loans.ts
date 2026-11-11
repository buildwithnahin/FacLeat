'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { loanFormSchema, loanApprovalSchema } from '@/server/validators/loans';

function handleError(error: unknown) {
  if (error instanceof BackendApiError) return { success: false as const, error: error.message };
  if (error instanceof Error) return { success: false as const, error: error.message };
  return { success: false as const, error: 'An unknown error occurred' };
}

export async function createLoanAction(formData: unknown) {
  try {
    const validatedData = loanFormSchema.parse(formData);
    const result = await backendFetch('/api/mobile/hr/loans-advances', {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/loans-advances');
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateLoanAction(id: string, formData: unknown) {
  try {
    const validatedData = loanFormSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/loans-advances/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/loans-advances');
    revalidatePath(`/hr/loans-advances/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function processLoanApprovalAction(id: string, formData: unknown) {
  try {
    const validatedData = loanApprovalSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/loans-advances/${id}/status`, {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/loans-advances');
    revalidatePath(`/hr/loans-advances/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}
