'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { leaveBalanceAdjustmentSchema } from '@/server/validators/leave-balance';

const PATH = '/hr/leave-balance';

export async function createLeaveBalanceAdjustmentAction(formData: FormData) {
  const returnPath = String(formData.get('returnPath') ?? PATH).trim() || PATH;
  const employeeId = String(formData.get('employeeId') ?? '');
  const leaveType = String(formData.get('leaveType') ?? '');
  const leaveYear = Number(formData.get('leaveYear') ?? 0);
  const adjustmentType = String(formData.get('adjustmentType') ?? '');
  const adjustmentDays = Number(formData.get('adjustmentDays') ?? 0);
  const reason = String(formData.get('reason') ?? '');
  const attachmentPath = formData.get('attachmentPath') ? String(formData.get('attachmentPath')) : null;

  const parsed = leaveBalanceAdjustmentSchema.safeParse({
    employeeId,
    leaveType,
    leaveYear,
    adjustmentType,
    adjustmentDays,
    reason,
    attachmentPath,
  });

  if (!parsed.success) {
    redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid adjustment input')}`);
  }

  try {
    await backendFetch('/api/mobile/hr/leave-balance/adjustments', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath(PATH);
    if (returnPath !== PATH) revalidatePath(returnPath.split('?')[0] ?? PATH);
    revalidatePath('/hr/leaves');
    revalidatePath('/hr/leave-approval');
    redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}success=${encodeURIComponent('Leave balance adjustment saved successfully.')}`);
  } catch (error) {
    if (error instanceof BackendApiError) {
      redirect(`${returnPath}${returnPath.includes('?') ? '&' : '?'}error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}
