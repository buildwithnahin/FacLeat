'use server';

import { revalidatePath } from 'next/cache';
import { loanFormSchema, loanApprovalSchema } from '../validators/loans';
import { LoansService } from '../services/loans.service';

function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}

export async function createLoanAction(formData: unknown) {
  try {
    const validatedData = loanFormSchema.parse(formData);
    const result = await LoansService.createLoan(validatedData);
    revalidatePath('/hr/loans-advances');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updateLoanAction(id: string, formData: unknown) {
  try {
    const validatedData = loanFormSchema.parse(formData);
    const result = await LoansService.updateLoan(id, validatedData);
    revalidatePath('/hr/loans-advances');
    revalidatePath(`/hr/loans-advances/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function processLoanApprovalAction(id: string, formData: unknown) {
  try {
    const { status, remarks } = loanApprovalSchema.parse(formData);
    const result = await LoansService.processApproval(id, status, remarks);
    revalidatePath('/hr/loans-advances');
    revalidatePath(`/hr/loans-advances/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
