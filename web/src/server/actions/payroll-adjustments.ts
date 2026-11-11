'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { payrollAdjustmentFormSchema, payrollAdjustmentApprovalSchema } from '@/server/validators/payroll-adjustment';

function handleError(error: unknown) {
  if (error instanceof BackendApiError) return { success: false as const, error: error.message };
  if (error instanceof Error) return { success: false as const, error: error.message };
  return { success: false as const, error: 'An unknown error occurred' };
}

export async function createPayrollAdjustment(formData: unknown) {
  try {
    const validatedData = payrollAdjustmentFormSchema.parse(formData);
    const result = await backendFetch('/api/mobile/hr/payroll-adjustment', {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/payroll-adjustment');
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updatePayrollAdjustment(id: string, formData: unknown) {
  try {
    const validatedData = payrollAdjustmentFormSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/payroll-adjustment/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/payroll-adjustment');
    revalidatePath(`/hr/payroll-adjustment/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function processPayrollAdjustmentApproval(id: string, formData: unknown) {
  try {
    const validatedData = payrollAdjustmentApprovalSchema.parse(formData);
    const result = await backendFetch(`/api/mobile/hr/payroll-adjustment/${id}/status`, {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    revalidatePath('/hr/payroll-adjustment');
    revalidatePath(`/hr/payroll-adjustment/${id}`);
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function deletePayrollAdjustment(id: string) {
  try {
    const result = await backendFetch(`/api/mobile/hr/payroll-adjustment/${id}`, { method: 'DELETE' });
    revalidatePath('/hr/payroll-adjustment');
    return { success: true as const, data: result };
  } catch (error) {
    return handleError(error);
  }
}
