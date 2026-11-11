'use server';

import { revalidatePath } from 'next/cache';
import { PayslipService } from '../services/payslip.service';
import { PayslipStatus, PaymentStatus } from '@prisma/client';

function handleError(error: unknown) {
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: 'An unknown error occurred' };
}

export async function updatePayslipStatus(id: string, formData: FormData) {
  try {
    const status = formData.get('status') as PayslipStatus;
    const paymentStatus = formData.get('paymentStatus') as PaymentStatus | null;
    
    const result = await PayslipService.updateStatus(id, status, paymentStatus || undefined);
    revalidatePath('/hr/payslip');
    revalidatePath(`/hr/payslip/${id}`);
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function publishAllPayslips(payrollRunId: string) {
  try {
    const result = await PayslipService.publishAll(payrollRunId);
    revalidatePath('/hr/payslip');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

export async function markAllPayslipsPaid(payrollRunId: string) {
  try {
    const result = await PayslipService.markAllPaid(payrollRunId);
    revalidatePath('/hr/payslip');
    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}
