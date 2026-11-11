'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { attendanceAdjustmentCancelSchema, attendanceAdjustmentUpsertSchema } from '@/server/validators/attendance-adjustments';

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
    const row = await backendFetch<{ id: string }>('/api/mobile/hr/attendance-adjustments', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath('/hr/attendance');
    revalidatePath('/hr/attendance-adjustment');
    revalidatePath('/hr/payroll');
    return { success: true, id: row.id };
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }
}

export async function cancelAttendanceAdjustmentAction(fd: FormData) {
  const parsed = attendanceAdjustmentCancelSchema.safeParse({ id: fd.get('id') });
  if (!parsed.success) {
    redirect('/hr/attendance-adjustment?error=Invalid%20attendance%20adjustment');
  }

  try {
    await backendFetch(`/api/mobile/hr/attendance-adjustments/${parsed.data.id}/cancel`, { method: 'POST' });
  } catch (error) {
    if (error instanceof BackendApiError) {
      redirect(`/hr/attendance-adjustment?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  revalidatePath('/hr/attendance-adjustment');
  redirect('/hr/attendance-adjustment');
}
