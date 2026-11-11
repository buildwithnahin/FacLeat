'use server';

import { revalidatePath } from 'next/cache';
import { calculatePayrollSchema, payrollApprovalSchema } from '../validators/payroll-run';
import { PayrollRunService } from '../services/payroll-run.service';
import { getSession } from '@/server/auth/session';

function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}

export async function calculatePayrollAction(formData: unknown) {
  try {
    const session = await getSession();
    const validatedData = calculatePayrollSchema.parse(formData);
    const result = await PayrollRunService.calculatePayroll(session, validatedData);
    revalidatePath('/hr/payroll-run');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function approvePayrollAction(id: string, formData: unknown) {
  try {
    const session = await getSession();
    const { level, status, remarks } = payrollApprovalSchema.parse(formData);
    const result = await PayrollRunService.approvePayroll(session, id, level, status, remarks);
    revalidatePath('/hr/payroll-run');
    revalidatePath(`/hr/payroll-run/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function closePayrollAction(id: string) {
  try {
    const session = await getSession();
    const result = await PayrollRunService.closePayroll(session, id);
    revalidatePath('/hr/payroll-run');
    revalidatePath(`/hr/payroll-run/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
