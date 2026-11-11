'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { attendanceSummaryService } from '@/server/services/attendance-summary.service';
import {
  attendanceSummaryGenerateSchema,
  attendanceSummaryActionSchema,
} from '@/server/validators/attendance-summary';
import { ApiError } from '@/lib/errors';

export type AttSummFormState = { error?: string; success?: boolean; generatedCount?: number } | undefined;

const PATH = '/hr/attendance-summary';

export async function generateAttendanceSummaryAction(_prev: AttSummFormState, fd: FormData): Promise<AttSummFormState> {
  const parsed = attendanceSummaryGenerateSchema.safeParse({
    summaryMonth: fd.get('summaryMonth'),
    branchId: fd.get('branchId'),
    department: fd.get('department') ?? '',
    shiftId: fd.get('shiftId') ?? '',
    employeeId: fd.get('employeeId') ?? '',
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  let url = `${PATH}?summaryMonth=${parsed.data.summaryMonth}&branchId=${parsed.data.branchId}`;
  if (parsed.data.department) url += `&department=${parsed.data.department}`;
  if (parsed.data.shiftId) url += `&shiftId=${parsed.data.shiftId}`;
  if (parsed.data.employeeId) url += `&employeeId=${parsed.data.employeeId}`;

  try {
    const session = await getSession();
    await attendanceSummaryService.generateOrRecalculate(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }

  redirect(url);
}

export async function singleSummaryAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const action = String(fd.get('action') ?? '') as any;

  if (!id || !action) return;

  const parsed = attendanceSummaryActionSchema.safeParse({ id, action });
  if (!parsed.success) return;

  try {
    const session = await getSession();
    await attendanceSummaryService.handleSingleAction(session, parsed.data);
    revalidatePath(PATH);
  } catch (e) {
    if (e instanceof ApiError) return;
    throw e;
  }
}

export async function recalculateSummaryAction(fd: FormData) {
  // Uses generateOrRecalculate for a single employee
  const summaryMonth = String(fd.get('summaryMonth') ?? '');
  const branchId = String(fd.get('branchId') ?? '');
  const employeeId = String(fd.get('employeeId') ?? '');
  
  if (!summaryMonth || !branchId || !employeeId) return;

  try {
    const session = await getSession();
    await attendanceSummaryService.generateOrRecalculate(session, {
      summaryMonth,
      branchId,
      employeeId,
    });
    revalidatePath(PATH);
  } catch (e) {
    // Ignore errors for server action silently, or surface them if needed.
  }
}
