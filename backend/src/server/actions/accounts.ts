'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { accountsService } from '@/server/services/accounts.service';
import { storagePut } from '@/server/storage';
import {
  journalCreateSchema,
  journalVoidSchema,
  periodCreateSchema,
  periodStatusSchema,
  type JournalCreateInput,
} from '@/server/validators/accounts';
import { ApiError } from '@/lib/errors';

const MAX_VOUCHER_IMAGE_BYTES = 2 * 1024 * 1024;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

async function storeVoucherImage(formData: FormData) {
  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.size > MAX_VOUCHER_IMAGE_BYTES) {
    throw new ApiError('Voucher image must be 2MB or smaller', 422);
  }
  if (!file.type.startsWith('image/')) {
    throw new ApiError('Voucher attachment must be an image', 422);
  }
  const { storagePath } = await storagePut(file.name, Buffer.from(await file.arrayBuffer()));
  return `/api/transactions/voucher-image?path=${encodeURIComponent(storagePath)}`;
}

export type JournalFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean; entryId?: string }
  | undefined;

export async function createJournalAction(
  _prev: JournalFormState,
  formData: FormData,
): Promise<JournalFormState> {
  const raw = formData.get('payload');
  if (typeof raw !== 'string') return { error: 'Missing payload' };
  let parsed;
  try {
    const obj = JSON.parse(raw) as JournalCreateInput;
    parsed = journalCreateSchema.safeParse(obj);
  } catch {
    return { error: 'Invalid payload' };
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await getSession();
    const entry = await accountsService.postJournal(session, parsed.data);
    revalidatePath('/accounts/journals');
    return { success: true, entryId: entry.id };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function postDraftAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const session = await getSession();
  try {
    await accountsService.postDraft(session, id);
  } catch (e) {
    if (e instanceof ApiError) return;
    throw e;
  }
  revalidatePath('/accounts/journals');
  revalidatePath(`/accounts/journals/${id}`);
}

export async function voidEntryAction(formData: FormData) {
  const parsed = journalVoidSchema.safeParse({
    id: formData.get('id'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) return;
  const session = await getSession();
  try {
    await accountsService.voidEntry(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return;
    throw e;
  }
  revalidatePath('/accounts/journals');
  revalidatePath(`/accounts/journals/${parsed.data.id}`);
  redirect(`/accounts/journals/${parsed.data.id}`);
}

export type PeriodFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | undefined;

export async function createPeriodAction(
  _prev: PeriodFormState,
  formData: FormData,
): Promise<PeriodFormState> {
  const parsed = periodCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    name: formData.get('name'),
    startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const session = await getSession();
    await accountsService.createPeriod(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/accounts/periods');
  return { success: true };
}

export async function setPeriodStatusAction(formData: FormData) {
  const parsed = periodStatusSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Validation failed' };
  }
  const session = await getSession();
  try {
    await accountsService.setPeriodStatus(session, parsed.data);
    revalidatePath('/accounts/periods');
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    return { error: 'Failed to update period status' };
  }
}

export async function getDailyCashFlowAction(filters: {
  branchId?: string;
  from: string;
  to: string;
}) {
  const session = await getSession();
  const result = await accountsService.dailyCashFlow(session, {
    branchId: filters.branchId ?? session?.activeBranchId ?? undefined,
    from: new Date(filters.from),
    to: new Date(filters.to + 'T23:59:59.999Z'),
  });
  return {
    userName: session?.name ?? 'Unknown User',
    summary: {
      openingBalance: result.summary.openingBalance.toString(),
      totalIn: result.summary.totalIn.toString(),
      totalOut: result.summary.totalOut.toString(),
      netBalance: result.summary.closingBalance.toString(),
    },
    rows: result.rows.map((r) => ({
      date: r.date,
      openingBalance: r.openingBalance.toString(),
      totalIn: r.totalIn.toString(),
      totalOut: r.totalOut.toString(),
      netBalance: r.netBalance.toString(),
      closingBalance: r.closingBalance.toString(),
      countIn: r.countIn,
      countOut: r.countOut,
    })),
  };
}

export async function getDailyCashFlowDetailsAction(filters: {
  branchId?: string;
  date: string;
}) {
  const session = await getSession();
  const result = await accountsService.dailyCashFlowDetails(session, {
    branchId: filters.branchId ?? session?.activeBranchId ?? undefined,
    date: new Date(filters.date + 'T00:00:00.000Z'),
  });
  return {
    date: result.date,
    summary: {
      totalIn: result.summary.totalIn.toString(),
      totalOut: result.summary.totalOut.toString(),
      netBalance: result.summary.netBalance.toString(),
      countIn: result.summary.countIn,
      countOut: result.summary.countOut,
    },
    items: result.items.map((item) => ({
      id: item.id,
      dateTime: item.dateTime.toISOString(),
      direction: item.direction,
      module: item.module,
      number: item.number,
      partyName: item.partyName,
      reference: item.reference,
      method: item.method,
      notes: item.notes,
      amount: item.amount.toString(),
    })),
  };
}

export async function getVouchersAction(filters: {
  branchId?: string;
  from: string;
  to: string;
  type: 'CASH_IN' | 'CASH_OUT' | 'CASH_TRANSFER' | 'BULK';
}) {
  const session = await getSession();
  return accountsService.listVouchers(session, {
    branchId: filters.branchId,
    from: new Date(filters.from),
    to: new Date(filters.to + 'T23:59:59.999Z'),
    type: filters.type,
  });
}

export async function createCashTransferAction(formData: FormData) {
  const session = await getSession();
  if (!session?.activeBranchId) throw new ApiError('No active branch selected');
  const imageUrl = await storeVoucherImage(formData);
  const transfer = await accountsService.createCashTransfer(session, {
    fromBranchId: session.activeBranchId,
    toBranchId: formString(formData, 'toBranchId'),
    amount: formString(formData, 'amount'),
    transferDate: new Date(formString(formData, 'transferDate')),
    transferVia: formString(formData, 'transferVia') || undefined,
    reference: formString(formData, 'reference') || undefined,
    remarks: formString(formData, 'remarks'),
    imageUrl,
  });
  revalidatePath('/transactions');
  return {
    id: transfer.id,
    number: transfer.number,
    toBranch: transfer.toBranch.name,
  };
}

export async function listCashTransfersAction(filters: {
  direction: 'SENT' | 'RECEIVED';
  from: string;
  to: string;
}) {
  const session = await getSession();
  if (!session?.activeBranchId) return [];
  return accountsService.listCashTransfers(session, {
    branchId: session.activeBranchId,
    direction: filters.direction,
    from: new Date(filters.from),
    to: new Date(filters.to + 'T23:59:59.999Z'),
  });
}

export async function listBranchesAction() {
  const session = await getSession();
  if (!session) return [];
  const { branchService } = await import('@/server/services/branch.service');
  const all = await branchService.listActive(session);
  return all
    .filter((b) => b.id !== session.activeBranchId)
    .map((b) => ({ id: b.id, name: b.name, code: b.code }));
}

// ── Cash Entry actions ────────────────────────────────────────────────────────

export async function createCashInAction(formData: FormData) {
  const session = await getSession();
  if (!session?.activeBranchId) throw new ApiError('No active branch selected');
  const imageUrl = await storeVoucherImage(formData);
  const entry = await accountsService.createCashEntry(session, {
    type: 'CASH_IN',
    branchId: session.activeBranchId,
    date: new Date(formString(formData, 'date')),
    amount: formString(formData, 'amount'),
    taxPercent: formString(formData, 'taxPercent') || undefined,
    contactId: formString(formData, 'contactId') || undefined,
    contactName: formString(formData, 'contactName') || undefined,
    receiveMode: formString(formData, 'receiveMode'),
    category: formString(formData, 'category'),
    reference: formString(formData, 'reference') || undefined,
    projectName: formString(formData, 'projectName') || undefined,
    remarks: formString(formData, 'remarks') || undefined,
    imageUrl,
  });
  revalidatePath('/transactions');
  return {
    id: entry.id,
    number: entry.number,
    date: entry.date.toISOString(),
    amount: entry.amount.toString(),
    totalAmount: entry.totalAmount.toString(),
    taxAmount: entry.taxAmount?.toString() ?? null,
    contactName: entry.contact?.name ?? entry.contactName ?? null,
    contactType: entry.contact?.type ?? null,
    receiveMode: entry.receiveMode,
    category: entry.category,
    reference: entry.reference ?? null,
    projectName: entry.projectName ?? null,
    remarks: entry.remarks ?? null,
    branchName: entry.branch.name,
    imageUrl: entry.imageUrl ?? null,
  };
}

export async function listCashInAction(filters: {
  branchId?: string;
  from: string;
  to: string;
}) {
  const session = await getSession();
  const rows = await accountsService.listCashEntries(session, {
    type: 'CASH_IN',
    branchId: filters.branchId ?? session?.activeBranchId ?? undefined,
    from: new Date(filters.from),
    to: new Date(filters.to + 'T23:59:59.999Z'),
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: r.date.toISOString(),
    amount: r.amount.toString(),
    totalAmount: r.totalAmount.toString(),
    taxAmount: r.taxAmount?.toString() ?? null,
    contactName: r.contact?.name ?? r.contactName ?? null,
    contactType: (r.contact?.type ?? r.contactType) as string | null,
    receiveMode: r.receiveMode,
    category: r.category,
    reference: r.reference ?? null,
    projectName: r.projectName ?? null,
    remarks: r.remarks ?? null,
    branchName: r.branch.name,
    sourceModule: r.sourceModule ?? null,
    sourceRefId: r.sourceRefId ?? null,
    imageUrl: r.imageUrl ?? null,
  }));
}

export async function getCashInSummaryAction(filters: {
  branchId?: string;
  from: string;
  to: string;
}) {
  const session = await getSession();
  const result = await accountsService.cashEntrySummary(session, {
    type: 'CASH_IN',
    branchId: filters.branchId ?? session?.activeBranchId ?? undefined,
    from: new Date(filters.from),
    to: new Date(filters.to + 'T23:59:59.999Z'),
  });
  return {
    openingBalance: result.openingBalance.toString(),
    totalIn: result.totalIn.toString(),
    totalOut: result.totalOut.toString(),
    netBalance: result.netBalance.toString(),
    count: result.count,
  };
}

export async function createCashOutAction(formData: FormData) {
  const session = await getSession();
  if (!session?.activeBranchId) throw new ApiError('No active branch selected');
  const imageUrl = await storeVoucherImage(formData);
  const entry = await accountsService.createCashEntry(session, {
    type: 'CASH_OUT',
    branchId: session.activeBranchId,
    date: new Date(formString(formData, 'date')),
    amount: formString(formData, 'amount'),
    taxPercent: formString(formData, 'taxPercent') || undefined,
    contactName: formString(formData, 'contactName') || undefined,
    contactType: formString(formData, 'contactType') || undefined,
    receiveMode: formString(formData, 'payMode'),
    category: formString(formData, 'category'),
    reference: formString(formData, 'reference') || undefined,
    projectName: formString(formData, 'projectName') || undefined,
    remarks: formString(formData, 'remarks') || undefined,
    imageUrl,
  });
  revalidatePath('/transactions');
  return {
    id: entry.id,
    number: entry.number,
    date: entry.date.toISOString(),
    amount: entry.amount.toString(),
    totalAmount: entry.totalAmount.toString(),
    taxAmount: entry.taxAmount?.toString() ?? null,
    contactName: entry.contact?.name ?? entry.contactName ?? null,
    contactType: entry.contact?.type ?? entry.contactType ?? null,
    payMode: entry.receiveMode,
    category: entry.category,
    reference: entry.reference ?? null,
    projectName: entry.projectName ?? null,
    remarks: entry.remarks ?? null,
    branchName: entry.branch.name,
    imageUrl: entry.imageUrl ?? null,
  };
}

export async function listCashOutAction(filters: {
  branchId?: string;
  from: string;
  to: string;
}) {
  const session = await getSession();
  const rows = await accountsService.listCashEntries(session, {
    type: 'CASH_OUT',
    branchId: filters.branchId ?? session?.activeBranchId ?? undefined,
    from: new Date(filters.from),
    to: new Date(filters.to + 'T23:59:59.999Z'),
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: r.date.toISOString(),
    amount: r.amount.toString(),
    totalAmount: r.totalAmount.toString(),
    taxAmount: r.taxAmount?.toString() ?? null,
    contactName: r.contact?.name ?? r.contactName ?? null,
    contactType: (r.contact?.type ?? r.contactType) as string | null,
    payMode: r.receiveMode,
    category: r.category,
    reference: r.reference ?? null,
    projectName: r.projectName ?? null,
    remarks: r.remarks ?? null,
    branchName: r.branch.name,
    sourceModule: r.sourceModule ?? null,
    sourceRefId: r.sourceRefId ?? null,
    imageUrl: r.imageUrl ?? null,
  }));
}

export async function getCashOutSummaryAction(filters: {
  branchId?: string;
  from: string;
  to: string;
}) {
  const session = await getSession();
  const result = await accountsService.cashEntrySummary(session, {
    type: 'CASH_OUT',
    branchId: filters.branchId ?? session?.activeBranchId ?? undefined,
    from: new Date(filters.from),
    to: new Date(filters.to + 'T23:59:59.999Z'),
  });
  return {
    openingBalance: result.openingBalance.toString(),
    totalIn: result.totalIn.toString(),
    totalOut: result.totalOut.toString(),
    netBalance: result.netBalance.toString(),
    count: result.count,
  };
}

export async function listContactsAction(branchId?: string) {
  const session = await getSession();
  if (!session) return [];
  const bid = branchId ?? session.activeBranchId ?? '';
  if (!bid) return [];
  return accountsService.listContactsForBranch(session, bid);
}

export async function listSuppliersAction(branchId?: string) {
  const session = await getSession();
  if (!session) return [];
  const bid = branchId ?? session.activeBranchId ?? '';
  if (!bid) return [];
  const { supplierService } = await import('@/server/services/supplier.service');
  const suppliers = await supplierService.list(session, { branchId: bid, status: 'ACTIVE' });
  return suppliers.map((s) => ({ id: s.id, name: s.name, type: 'SUPPLIER', code: s.code }));
}

export async function getNextVoucherNumberAction() {
  const session = await getSession();
  return accountsService.nextCashEntryNumber(session);
}
