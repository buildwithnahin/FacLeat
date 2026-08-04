'use server';

import { revalidatePath } from 'next/cache';
import { payrollAdjustmentFormSchema, payrollAdjustmentApprovalSchema } from '../validators/payroll-adjustment';
import { PayrollAdjustmentService } from '../services/payroll-adjustment.service';
import { PayrollAdjustmentStatus } from '@prisma/client';
import { getSession } from '@/server/auth/session';

function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}

export async function createPayrollAdjustment(formData: unknown) {
  try {
    const session = await getSession();
    const validatedData = payrollAdjustmentFormSchema.parse(formData);
    const result = await PayrollAdjustmentService.createAdjustment(session, validatedData);
    revalidatePath('/hr/payroll-adjustment');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function updatePayrollAdjustment(id: string, formData: unknown) {
  try {
    const session = await getSession();
    const validatedData = payrollAdjustmentFormSchema.parse(formData);
    const { employeeIds, ...updateData } = validatedData;
    const result = await PayrollAdjustmentService.updateAdjustment(session, id, updateData);
    revalidatePath('/hr/payroll-adjustment');
    revalidatePath(`/hr/payroll-adjustment/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function processPayrollAdjustmentApproval(id: string, formData: unknown) {
  try {
    const session = await getSession();
    const { status, remarks } = payrollAdjustmentApprovalSchema.parse(formData);
    const result = await PayrollAdjustmentService.updateStatus(session, id, status as PayrollAdjustmentStatus, remarks);
    revalidatePath('/hr/payroll-adjustment');
    revalidatePath(`/hr/payroll-adjustment/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function deletePayrollAdjustment(id: string) {
  try {
    const session = await getSession();
    const result = await PayrollAdjustmentService.deleteAdjustment(session, id);
    revalidatePath('/hr/payroll-adjustment');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
