'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { leavesService } from '@/server/services/leaves.service';
import { resolveLeavePolicyForEmployee } from '@/server/services/leave-policies.service';
import { leaveApplicationSchema, leaveApprovalSchema } from '@/server/validators/leaves';
import { ApiError } from '@/lib/errors';

export type LeaveFormState = { error?: string; success?: boolean } | undefined;

const PATH = '/hr/leaves';

export async function applyLeaveAction(_prev: LeaveFormState, fd: FormData): Promise<LeaveFormState> {
  const employeeId = String(fd.get('employeeId') ?? '');
  const type = String(fd.get('type') ?? '') as any;
  const fromDate = String(fd.get('fromDate') ?? '');
  const toDate = String(fd.get('toDate') ?? '');
  const halfDay = fd.get('halfDay') === 'true';
  const halfDayType = fd.get('halfDayType') ? String(fd.get('halfDayType')) : null;
  const reason = String(fd.get('reason') ?? '');
  const attachmentPath = fd.get('attachmentPath') ? String(fd.get('attachmentPath')) : null;
  const emergencyContact = fd.get('emergencyContact') ? String(fd.get('emergencyContact')) : null;
  const handoverEmployeeId = fd.get('handoverEmployeeId') ? String(fd.get('handoverEmployeeId')) : null;

  const parsed = leaveApplicationSchema.safeParse({
    employeeId,
    type,
    fromDate,
    toDate,
    halfDay,
    halfDayType,
    reason,
    attachmentPath,
    emergencyContact,
    handoverEmployeeId,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  try {
    const session = await getSession();
    await leavesService.apply(session, parsed.data);
    revalidatePath(PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function decideLeaveAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const stage = String(fd.get('stage') ?? '') as any;
  const action = String(fd.get('action') ?? '') as any;
  const remarks = fd.get('remarks') ? String(fd.get('remarks')) : null;

  const parsed = leaveApprovalSchema.safeParse({ id, stage, action, remarks });
  if (!parsed.success) return;

  try {
    const session = await getSession();
    await leavesService.decide(session, parsed.data);
    revalidatePath(PATH);
    revalidatePath('/hr/leave-approval');
  } catch (e) {
    // silently ignore or handle
  }
}

export async function withdrawLeaveAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!id) return;

  try {
    const session = await getSession();
    await leavesService.withdraw(session, id);
    revalidatePath(PATH);
  } catch (e) {
    // silently ignore or handle
  }
}

export async function getLeaveBalanceAction(employeeId: string, year: number) {
  try {
    const session = await getSession();
    return await leavesService.getLeaveBalance(session, employeeId, year);
  } catch (e) {
    return null;
  }
}

export async function getLeavePolicyPreviewAction(employeeId: string, year: number) {
  try {
    const session = await getSession();
    const [policy, balance] = await Promise.all([
      resolveLeavePolicyForEmployee(employeeId, new Date(Date.UTC(year, 0, 1))),
      leavesService.getLeaveBalance(session, employeeId, year),
    ]);
    return { policy, balance };
  } catch (error) {
    return null;
  }
}
