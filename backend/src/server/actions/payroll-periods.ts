'use server';

import { revalidatePath } from 'next/cache';
import { payrollPeriodFormSchema, payrollPeriodStatusSchema } from '../validators/payroll-periods';
import { PayrollPeriodsService } from '../services/payroll-periods.service';
import { getSession } from '@/server/auth/session';

function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}

export async function createPayrollPeriod(formData: unknown) {
  try {
    const session = await getSession();
    const validatedData = payrollPeriodFormSchema.parse(formData);
    const result = await PayrollPeriodsService.createPayrollPeriod(session, validatedData);
    revalidatePath('/hr/payroll-period');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updatePayrollPeriod(id: string, formData: unknown) {
  try {
    const session = await getSession();
    const validatedData = payrollPeriodFormSchema.parse(formData);
    const result = await PayrollPeriodsService.updatePayrollPeriod(session, id, validatedData);
    revalidatePath('/hr/payroll-period');
    revalidatePath(`/hr/payroll-period/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function changePayrollPeriodStatus(id: string, formData: unknown) {
  try {
    const session = await getSession();
    const { status, reason } = payrollPeriodStatusSchema.parse(formData);
    const result = await PayrollPeriodsService.changeStatus(session, id, status, reason);
    revalidatePath('/hr/payroll-period');
    revalidatePath(`/hr/payroll-period/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
