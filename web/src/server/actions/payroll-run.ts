'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { calculatePayrollSchema, payrollApprovalSchema } from '@/server/validators/payroll-run';

function handleError(error: unknown) {
  if (error instanceof BackendApiError) return { success: false as const, error: error.message };
  if (error instanceof Error) return { success: false as const, error: error.message };
  return { success: false as const, error: 'An unknown error occurred' };
}

export async function calculatePayrollAction(formData: unknown) {
  try {
    const validatedData = calculatePayrollSchema.parse(formData);
    const result = await backendFetch<{ id: string }>('/api/mobile/hr/payroll-run', {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/payroll-run');
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function approvePayrollAction(id: string, formData: unknown) {
  try {
    const validatedData = payrollApprovalSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/payroll-run/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/payroll-run');
    revalidatePath(`/hr/payroll-run/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function closePayrollAction(id: string) {
  try {
    const result = await backendFetch(`/api/mobile/hr/payroll-run/${id}/close`, { method: 'POST' });
    revalidatePath('/hr/payroll-run');
    revalidatePath(`/hr/payroll-run/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}
