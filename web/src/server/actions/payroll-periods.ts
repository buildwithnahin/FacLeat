'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { payrollPeriodFormSchema, payrollPeriodStatusSchema } from '@/server/validators/payroll-periods';

function handleError(error: unknown) {
  if (error instanceof BackendApiError) return { success: false as const, error: error.message };
  if (error instanceof Error) return { success: false as const, error: error.message };
  return { success: false as const, error: 'An unknown error occurred' };
}

export async function createPayrollPeriod(formData: unknown) {
  try {
    const validatedData = payrollPeriodFormSchema.parse(formData);
    const result = await backendFetch('/api/mobile/hr/payroll-period', {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/payroll-period');
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updatePayrollPeriod(id: string, formData: unknown) {
  try {
    const validatedData = payrollPeriodFormSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/payroll-period/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/payroll-period');
    revalidatePath(`/hr/payroll-period/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function changePayrollPeriodStatus(id: string, formData: unknown) {
  try {
    const validatedData = payrollPeriodStatusSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/payroll-period/${id}/status`, {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/payroll-period');
    revalidatePath(`/hr/payroll-period/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}
