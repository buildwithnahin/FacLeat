'use server';

import { revalidatePath } from 'next/cache';
import { calculatePayrollSchema, payrollApprovalSchema } from '../validators/payroll-run';
import { PayrollRunService } from '../services/payroll-run.service';

function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}

export async function calculatePayrollAction(formData: unknown) {
  try {
    const validatedData = calculatePayrollSchema.parse(formData);
    const result = await PayrollRunService.calculatePayroll(validatedData);
    revalidatePath('/hr/payroll-run');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function approvePayrollAction(id: string, formData: unknown) {
  try {
    const { level, status, remarks } = payrollApprovalSchema.parse(formData);
    const result = await PayrollRunService.approvePayroll(id, level, status, remarks);
    revalidatePath('/hr/payroll-run');
    revalidatePath(`/hr/payroll-run/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function closePayrollAction(id: string) {
  try {
    const result = await PayrollRunService.closePayroll(id);
    revalidatePath('/hr/payroll-run');
    revalidatePath(`/hr/payroll-run/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
