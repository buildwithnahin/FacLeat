'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { overtimeService } from '@/server/services/overtime.service';
import {
  overtimeGenerateSchema,
  overtimeCreateSchema,
  overtimeManagerApprovalSchema,
  overtimeHrVerificationSchema,
  overtimeAccountsApprovalSchema,
} from '@/server/validators/overtime';
import { ApiError } from '@/lib/errors';

export type OtFormState =
  | { error?: string; success?: boolean; generatedCount?: number }
  | undefined;

const OT_PATH = '/hr/overtime';

export async function generateOvertimeAction(_prev: OtFormState, fd: FormData): Promise<OtFormState> {
  const parsed = overtimeGenerateSchema.safeParse({
    date: fd.get('date'),
    branchId: fd.get('branchId'),
    department: fd.get('department') ?? '',
    shiftId: fd.get('shiftId') ?? '',
    employeeId: fd.get('employeeId') ?? '',
    otType: fd.get('otType') ?? 'REGULAR',
    otRateType: fd.get('otRateType') ?? 'FIXED_RATE',
    otRatePerHour: fd.get('otRatePerHour') ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  try {
    const session = await getSession();
    const result = await overtimeService.generateFromAttendance(session, parsed.data);
    revalidatePath(OT_PATH);
    return { success: true, generatedCount: result.generatedCount };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function createOvertimeAction(_prev: OtFormState, fd: FormData): Promise<OtFormState> {
  const parsed = overtimeCreateSchema.safeParse({
    branchId: fd.get('branchId'),
    employeeId: fd.get('employeeId'),
    otDate: fd.get('otDate'),
    otType: fd.get('otType'),
    source: fd.get('source') ?? 'MANUAL_ENTRY',
    otRateType: fd.get('otRateType') ?? 'FIXED_RATE',
    otRatePerHour: fd.get('otRatePerHour') ?? 0,
    approvedOtMinutes: fd.get('approvedOtMinutes') ?? 0,
    remarks: fd.get('remarks') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  try {
    const session = await getSession();
    await overtimeService.create(session, parsed.data);
    revalidatePath(OT_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function overtimeStatusAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const action = String(fd.get('action') ?? '');
  if (!id || !action) return;

  const session = await getSession();
  try {
    if (action === 'submit') {
      await overtimeService.submit(session, id);
    } else if (action === 'cancel') {
      await overtimeService.cancel(session, id);
    } else if (action === 'post-payroll') {
      await overtimeService.postToPayroll(session, id);
    } else if (action === 'manager-approve' || action === 'manager-reject' || action === 'manager-sendback') {
      const decision = action === 'manager-approve' ? 'APPROVED' : action === 'manager-reject' ? 'REJECTED' : 'SENT_BACK';
      const parsed = overtimeManagerApprovalSchema.safeParse({
        id,
        decision,
        approvedOtMinutes: fd.get('approvedOtMinutes') ?? undefined,
        remarks: fd.get('remarks') ?? '',
      });
      if (parsed.success) await overtimeService.managerApproval(session, parsed.data);
    } else if (action === 'hr-verify' || action === 'hr-reject' || action === 'hr-sendback') {
      const decision = action === 'hr-verify' ? 'VERIFIED' : action === 'hr-reject' ? 'REJECTED' : 'SENT_BACK';
      const parsed = overtimeHrVerificationSchema.safeParse({
        id,
        decision,
        verifiedMinutes: fd.get('verifiedMinutes') ?? undefined,
        remarks: fd.get('remarks') ?? '',
      });
      if (parsed.success) await overtimeService.hrVerification(session, parsed.data);
    } else if (action === 'accounts-approve' || action === 'accounts-reject' || action === 'accounts-correction') {
      const decision = action === 'accounts-approve' ? 'APPROVED' : action === 'accounts-reject' ? 'REJECTED' : 'CORRECTION_REQUESTED';
      const parsed = overtimeAccountsApprovalSchema.safeParse({
        id,
        decision,
        otRate: fd.get('otRate') ?? undefined,
        payrollMonth: fd.get('payrollMonth') ?? '',
        costCenter: fd.get('costCenter') ?? '',
        remarks: fd.get('remarks') ?? '',
      });
      if (parsed.success) await overtimeService.accountsApproval(session, parsed.data);
    }
  } catch (e) {
    if (e instanceof ApiError) return;
    throw e;
  }
  revalidatePath(OT_PATH);
}
