'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import {
  ATTENDANCE_ADJUSTMENT_TABLE_MESSAGE,
  attendanceAdjustmentsService,
  isAttendanceAdjustmentTableAvailable,
} from '@/server/services/attendance-adjustments.service';
import {
  attendanceAdjustmentCancelSchema,
  attendanceAdjustmentUpsertSchema,
} from '@/server/validators/attendance-adjustments';
import { ApiError } from '@/lib/errors';

export type AttendanceAdjustmentFormState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined>; success?: boolean; id?: string }
  | undefined;

function parseAttendanceAdjustmentForm(fd: FormData) {
  return {
    id: fd.get('id') || undefined,
    employeeId: fd.get('employeeId'),
    attendanceDate: fd.get('attendanceDate'),
    adjustmentType: fd.get('adjustmentType'),
    newCheckIn: fd.get('newCheckIn') ?? '',
    newCheckOut: fd.get('newCheckOut') ?? '',
    newStatus: fd.get('newStatus'),
    newShiftId: fd.get('newShiftId') ?? '',
    reason: fd.get('reason'),
    attachmentUrl: fd.get('attachmentUrl') ?? '',
    remarks: fd.get('remarks') ?? '',
    intent: fd.get('intent') ?? 'draft',
  };
}

export async function saveAttendanceAdjustmentAction(
  _prev: AttendanceAdjustmentFormState,
  fd: FormData,
): Promise<AttendanceAdjustmentFormState> {
  const parsed = attendanceAdjustmentUpsertSchema.safeParse(parseAttendanceAdjustmentForm(fd));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    const session = await getSession();
    const row = await attendanceAdjustmentsService.save(session, parsed.data);
    revalidatePath('/hr/attendance');
    revalidatePath('/hr/attendance-adjustment');
    revalidatePath('/hr/payroll');
    return { success: true, id: row.id };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function cancelAttendanceAdjustmentAction(fd: FormData) {
  const parsed = attendanceAdjustmentCancelSchema.safeParse({
    id: fd.get('id'),
  });
  if (!parsed.success) {
    redirect('/hr/attendance-adjustment?error=Invalid%20attendance%20adjustment');
  }

  try {
    const session = await getSession();
    await attendanceAdjustmentsService.cancel(session, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(`/hr/attendance-adjustment?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath('/hr/attendance-adjustment');
  redirect('/hr/attendance-adjustment');
}

export async function ensureAttendanceAdjustmentAvailability() {
  const available = await isAttendanceAdjustmentTableAvailable();
  return available ? null : ATTENDANCE_ADJUSTMENT_TABLE_MESSAGE;
}
