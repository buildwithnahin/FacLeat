'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { transfersService } from '@/server/services/transfers.service';
import {
  transferCreateSchema,
  transferUpdateSchema,
  transferStatusActionSchema,
} from '@/server/validators/transfers';
import { ApiError } from '@/lib/errors';

export type TransferFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean; id?: string }
  | undefined;

function parseTransferForm(fd: FormData) {
  return {
    branchId: fd.get('branchId'),
    employeeId: fd.get('employeeId'),
    transferType: fd.get('transferType'),
    reason: fd.get('reason'),
    remarks: fd.get('remarks') ?? '',
    newReportingManagerId: fd.get('newReportingManagerId') ?? '',
    newBranchId: fd.get('newBranchId') ?? '',
    newDepartment: fd.get('newDepartment') ?? '',
    newShiftId: fd.get('newShiftId') ?? '',
    tempBranchId: fd.get('tempBranchId') ?? '',
    tempDepartment: fd.get('tempDepartment') ?? '',
    tempShiftId: fd.get('tempShiftId') ?? '',
    startDate: fd.get('startDate') ?? '',
    endDate: fd.get('endDate') ?? '',
    effectiveDate: fd.get('effectiveDate') ?? '',
  };
}

export async function createTransferAction(
  _prev: TransferFormState,
  fd: FormData,
): Promise<TransferFormState> {
  const parsed = transferCreateSchema.safeParse(parseTransferForm(fd));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    const session = await getSession();
    const transfer = await transfersService.create(session, parsed.data);
    revalidatePath('/hr/transfers');
    return { success: true, id: transfer.id };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function updateTransferAction(
  _prev: TransferFormState,
  fd: FormData,
): Promise<TransferFormState> {
  const parsed = transferUpdateSchema.safeParse({
    id: fd.get('id'),
    ...parseTransferForm(fd),
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    const session = await getSession();
    await transfersService.update(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }

  revalidatePath('/hr/transfers');
  redirect('/hr/transfers');
}

export async function changeTransferStatusAction(fd: FormData) {
  const parsed = transferStatusActionSchema.safeParse({
    id: fd.get('id'),
    action: fd.get('action'),
    rejectionReason: fd.get('rejectionReason') ?? '',
  });
  if (!parsed.success) return;

  const session = await getSession();
  try {
    await transfersService.changeStatus(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return;
    throw e;
  }

  revalidatePath('/hr/transfers');
}
