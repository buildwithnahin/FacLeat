'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getSession } from '@/server/auth/session';
import { contractsService } from '@/server/services/contracts.service';
import { contractCreateSchema, contractUpdateSchema } from '@/server/validators/contracts';
import { ApiError } from '@/lib/errors';

export type ContractFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | undefined;

const UPLOAD_ROOT = path.resolve(process.cwd(), 'server/upload');
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.svg']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

function sanitizeFilenameSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function storeContractAttachment(file: File, contractNo: string): Promise<string> {
  const extension = path.extname(file.name || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error('Attachment must be an image (PNG, JPG, WEBP, SVG) or document (PDF, DOC, DOCX)');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Attachment file size must be 10MB or less');
  }

  const safeContractNo = sanitizeFilenameSegment(contractNo) || 'contract';
  const generatedName = `${safeContractNo}-${randomUUID()}${extension}`;
  const absolutePath = path.join(UPLOAD_ROOT, generatedName);

  await mkdir(UPLOAD_ROOT, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return path.posix.join('server', 'upload', generatedName);
}

function parseContractForm(formData: FormData, attachmentUrl?: string | null) {
  return {
    contractNo: formData.get('contractNo'),
    employeeId: formData.get('employeeId'),
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

export async function createContractAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const file = formData.get('attachmentFile');
  const contractNo = String(formData.get('contractNo') || '').trim();

  let attachmentUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      attachmentUrl = await storeContractAttachment(file, contractNo);
    } catch (e: any) {
      return { error: e.message || 'Failed to upload attachment file' };
    }
  }

  const parsed = contractCreateSchema.safeParse(parseContractForm(formData, attachmentUrl));
  if (!parsed.success) {
    if (attachmentUrl) {
      await unlink(path.resolve(process.cwd(), attachmentUrl)).catch(() => {});
    }
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await getSession();
    await contractsService.create(session, parsed.data);
  } catch (error) {
    if (attachmentUrl) {
      await unlink(path.resolve(process.cwd(), attachmentUrl)).catch(() => {});
    }
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  revalidatePath('/hr/contracts');
  redirect('/hr/contracts');
}

export async function updateContractAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const id = formData.get('id');
  const file = formData.get('attachmentFile');
  const contractNo = String(formData.get('contractNo') || '').trim();
  const existingAttachmentUrl = formData.get('existingAttachmentUrl');

  let attachmentUrl = typeof existingAttachmentUrl === 'string' ? existingAttachmentUrl : null;
  let isNewUpload = false;

  if (file instanceof File && file.size > 0) {
    try {
      attachmentUrl = await storeContractAttachment(file, contractNo);
      isNewUpload = true;
    } catch (e: any) {
      return { error: e.message || 'Failed to upload attachment file' };
    }
  }

  const parsed = contractUpdateSchema.safeParse({
    id: formData.get('id'),
    ...parseContractForm(formData, attachmentUrl),
  });
  if (!parsed.success) {
    if (isNewUpload && attachmentUrl) {
      await unlink(path.resolve(process.cwd(), attachmentUrl)).catch(() => {});
    }
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await getSession();
    await contractsService.update(session, parsed.data);

    if (isNewUpload && existingAttachmentUrl && typeof existingAttachmentUrl === 'string') {
      await unlink(path.resolve(process.cwd(), existingAttachmentUrl)).catch(() => {});
    }
  } catch (error) {
    if (isNewUpload && attachmentUrl) {
      await unlink(path.resolve(process.cwd(), attachmentUrl)).catch(() => {});
    }
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  revalidatePath('/hr/contracts');
  redirect('/hr/contracts');
}

export async function deleteContractAction(id: string): Promise<{ error?: string } | undefined> {
  try {
    const session = await getSession();
    const deleted = await contractsService.delete(session, id);
    if (deleted?.attachmentUrl) {
      await unlink(path.resolve(process.cwd(), deleted.attachmentUrl)).catch(() => {});
    }
    revalidatePath('/hr/contracts');
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
