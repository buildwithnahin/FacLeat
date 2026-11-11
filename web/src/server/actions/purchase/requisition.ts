'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { runDecisionAndRedirect } from '@/lib/decision-notice';
import { requisitionCreateSchema, requisitionDecisionSchema } from '@/server/validators/purchase';
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
    await backendFetch('/api/mobile/purchase/requisitions', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
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
  await runDecisionAndRedirect(
    () =>
      backendFetch(`/api/mobile/purchase/requisitions/${parsed.data.id}/decision`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      }),
    `/purchase/requisitions/${parsed.data.id}`,
    '/purchase/requisitions',
  );
}
