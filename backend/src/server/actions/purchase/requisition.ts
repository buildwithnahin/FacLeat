'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { purchaseService } from '@/server/services/purchase.service';
import { requisitionCreateSchema, requisitionDecisionSchema } from '@/server/validators/purchase';
import { ApiError } from '@/lib/errors';
import { parseItems, type PurchaseFormState } from './shared';

export async function createRequisitionAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const parsed = requisitionCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    department: formData.get('department'),
    requestedBy: formData.get('requestedBy'),
    priority: formData.get('priority') ?? 'MEDIUM',
    requiredDate: formData.get('requiredDate'),
    notes: formData.get('notes') ?? '',
    items: parseItems(formData),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await purchaseService.createRequisition(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/requisitions');
  redirect('/purchase/requisitions');
}

export async function decideRequisitionAction(formData: FormData) {
  const parsed = requisitionDecisionSchema.safeParse({
    id: formData.get('id'),
    decision: formData.get('decision'),
    reason: formData.get('reason') ?? '',
  });
  if (!parsed.success) throw new Error('Invalid decision payload');
  const session = await getSession();
  try {
    await purchaseService.decideRequisition(session, parsed.data);
  } catch (e) {
    // Approval was requested/pending instead of applied outright — the
    // ApprovalStatusBanner on the detail page surfaces this, no need to crash.
    if (!(e instanceof ApiError)) throw e;
  }
  revalidatePath('/purchase/requisitions');
  revalidatePath(`/purchase/requisitions/${parsed.data.id}`);
}
