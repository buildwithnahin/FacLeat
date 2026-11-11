'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, backendUpload, BackendApiError } from '@/lib/backend-client';
import { contractCreateSchema, contractUpdateSchema } from '@/server/validators/contracts';

export type ContractFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | undefined;

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof BackendApiError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

function parseContractForm(formData: FormData, attachmentUrl?: string | null) {
  return {
    contractNo: formData.get('contractNo'),
    employeeId: formData.get('employeeId'),
    candidateId: formData.get('candidateId') || null,
    offerId: formData.get('offerId') || null,
    candidateName: formData.get('candidateName') || null,
    branchId: formData.get('branchId') || null,
    department: formData.get('department') || null,
    designation: formData.get('designation') || null,
    contractType: formData.get('contractType'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate') || null,
    basicSalary: formData.get('basicSalary'),
    allowances: formData.get('allowances') || '0',
    shiftId: formData.get('shiftId') || null,
    weeklyOff: formData.get('weeklyOff') || 'Friday',
    status: formData.get('status') || 'DRAFT',
    attachmentUrl: attachmentUrl !== undefined ? attachmentUrl : (formData.get('attachmentUrl') || null),
    notes: formData.get('notes') || null,
  };
}

async function uploadAttachmentIfPresent(formData: FormData): Promise<string | null> {
  const file = formData.get('attachmentFile');
  if (!(file instanceof File) || file.size === 0) return null;

  const form = new FormData();
  form.set('attachmentFile', file);
  const { attachmentUrl } = await backendUpload<{ attachmentUrl: string }>('/api/mobile/hr/contracts/upload', form);
  return attachmentUrl;
}

export async function createContractAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const scope = String(formData.get('scope') || 'employee');

  let attachmentUrl: string | null = null;
  try {
    attachmentUrl = await uploadAttachmentIfPresent(formData);
  } catch (error: unknown) {
    return { error: errorMessage(error, 'Failed to upload attachment file') };
  }

  const parsed = contractCreateSchema.safeParse(parseContractForm(formData, attachmentUrl));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await backendFetch('/api/mobile/hr/contracts', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return { error: errorMessage(error, 'Failed to create contract') };
  }

  revalidatePath('/hr/contracts');
  revalidatePath('/hr/offer-contracts');
  redirect(scope === 'offer' ? '/hr/offer-contracts' : '/hr/contracts');
}

export async function updateContractAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const scope = String(formData.get('scope') || 'employee');
  const existingAttachmentUrl = formData.get('existingAttachmentUrl');

  let attachmentUrl = typeof existingAttachmentUrl === 'string' ? existingAttachmentUrl : null;
  try {
    const uploaded = await uploadAttachmentIfPresent(formData);
    if (uploaded) attachmentUrl = uploaded;
  } catch (error: unknown) {
    return { error: errorMessage(error, 'Failed to upload attachment file') };
  }

  const parsed = contractUpdateSchema.safeParse({
    id: formData.get('id'),
    ...parseContractForm(formData, attachmentUrl),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await backendFetch(`/api/mobile/hr/contracts/${parsed.data.id}`, {
      method: 'PUT',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return { error: errorMessage(error, 'Failed to update contract') };
  }

  revalidatePath('/hr/contracts');
  revalidatePath('/hr/offer-contracts');
  redirect(scope === 'offer' ? '/hr/offer-contracts' : '/hr/contracts');
}

export async function deleteContractAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    await backendFetch(`/api/mobile/hr/contracts/${id}`, { method: 'DELETE' });
    revalidatePath('/hr/contracts');
    revalidatePath('/hr/offer-contracts');
  } catch (error) {
    return { error: errorMessage(error, 'Failed to delete contract') };
  }
}
