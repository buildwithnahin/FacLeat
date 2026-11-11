'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { backendFetch, backendUpload, BackendApiError } from '@/lib/backend-client';
import {
  journalCreateSchema,
  journalVoidSchema,
  periodCreateSchema,
  periodStatusSchema,
  type JournalCreateInput,
} from '@/server/validators/accounts';

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
    const entry = await backendFetch<{ id: string }>('/api/mobile/accounts/journals', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath('/accounts/journals');
    return { success: true, entryId: entry.id };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}

export async function postDraftAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  try {
    await backendFetch(`/api/mobile/accounts/journals/${id}/post`, { method: 'POST' });
  } catch (e) {
    if (e instanceof BackendApiError) return;
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
  try {
    await backendFetch(`/api/mobile/accounts/journals/${parsed.data.id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason: parsed.data.reason }),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return;
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
    await backendFetch('/api/mobile/accounts/periods', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
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
  if (!parsed.success) return;
  try {
    await backendFetch(`/api/mobile/accounts/periods/${parsed.data.id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: parsed.data.status }),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return;
    throw e;
  }
  revalidatePath('/accounts/periods');
}

interface DailyCashFlowRowDto {
  date: string;
  openingBalance: string;
  totalIn: string;
  totalOut: string;
  netBalance: string;
  closingBalance: string;
  countIn: number;
  countOut: number;
}

interface DailyCashFlowDto {
  userName: string;
  summary: { openingBalance: string; totalIn: string; totalOut: string; netBalance: string };
  rows: DailyCashFlowRowDto[];
}

export async function getDailyCashFlowAction(filters: {
  branchId?: string;
  from: string;
  to: string;
}) {
  const sp = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.branchId) sp.set('branchId', filters.branchId);
  return backendFetch<DailyCashFlowDto>(`/api/mobile/accounts/daily-cash-flow?${sp.toString()}`);
}

export async function getDailyCashFlowDetailsAction(filters: { branchId?: string; date: string }) {
  const sp = new URLSearchParams({ date: filters.date });
  if (filters.branchId) sp.set('branchId', filters.branchId);
  return backendFetch(`/api/mobile/accounts/daily-cash-flow/details?${sp.toString()}`);
}

export async function getVouchersAction(filters: {
  branchId?: string;
  from: string;
  to: string;
  type: 'CASH_IN' | 'CASH_OUT' | 'CASH_TRANSFER' | 'BULK';
}) {
  const sp = new URLSearchParams({ from: filters.from, to: filters.to, type: filters.type });
  if (filters.branchId) sp.set('branchId', filters.branchId);
  return backendFetch(`/api/mobile/accounts/vouchers?${sp.toString()}`);
}

export async function createCashTransferAction(formData: FormData) {
  const result = await backendUpload<{ id: string; number: string; toBranch: string }>(
    '/api/mobile/accounts/cash-transfers',
    formData,
  );
  revalidatePath('/transactions');
  return result;
}

export async function listCashTransfersAction(filters: {
  direction: 'SENT' | 'RECEIVED';
  from: string;
  to: string;
}) {
  // No client-side active-branch pre-check needed — the backend route
  // derives branchId from the bearer session itself and returns [] when
  // there's no active branch, same contract root's page-level check gave.
  const sp = new URLSearchParams({ direction: filters.direction, from: filters.from, to: filters.to });
  return backendFetch(`/api/mobile/accounts/cash-transfers?${sp.toString()}`);
}

export async function listBranchesAction() {
  const session = await getSession();
  if (!session) return [];
  const branches = await backendFetch<Array<{ id: string; name: string; code: string }>>(
    '/api/mobile/branches',
  );
  return branches.filter((b) => b.id !== session.activeBranchId);
}

// ── Cash Entry actions ────────────────────────────────────────────────────────

export async function createCashInAction(formData: FormData) {
  const fd = new FormData();
  for (const [key, value] of formData.entries()) fd.set(key, value);
  fd.set('type', 'CASH_IN');
  const result = await backendUpload('/api/mobile/accounts/cash-entries', fd);
  revalidatePath('/transactions');
  return result;
}

export async function listCashInAction(filters: { branchId?: string; from: string; to: string }) {
  const sp = new URLSearchParams({ type: 'CASH_IN', from: filters.from, to: filters.to });
  if (filters.branchId) sp.set('branchId', filters.branchId);
  return backendFetch(`/api/mobile/accounts/cash-entries?${sp.toString()}`);
}

export async function getCashInSummaryAction(filters: { branchId?: string; from: string; to: string }) {
  const sp = new URLSearchParams({ type: 'CASH_IN', from: filters.from, to: filters.to });
  if (filters.branchId) sp.set('branchId', filters.branchId);
  return backendFetch(`/api/mobile/accounts/cash-entries/summary?${sp.toString()}`);
}

export async function createCashOutAction(formData: FormData) {
  const fd = new FormData();
  for (const [key, value] of formData.entries()) fd.set(key, value);
  fd.set('type', 'CASH_OUT');
  const result = await backendUpload('/api/mobile/accounts/cash-entries', fd);
  revalidatePath('/transactions');
  return result;
}

export async function listCashOutAction(filters: { branchId?: string; from: string; to: string }) {
  const sp = new URLSearchParams({ type: 'CASH_OUT', from: filters.from, to: filters.to });
  if (filters.branchId) sp.set('branchId', filters.branchId);
  return backendFetch(`/api/mobile/accounts/cash-entries?${sp.toString()}`);
}

export async function getCashOutSummaryAction(filters: { branchId?: string; from: string; to: string }) {
  const sp = new URLSearchParams({ type: 'CASH_OUT', from: filters.from, to: filters.to });
  if (filters.branchId) sp.set('branchId', filters.branchId);
  return backendFetch(`/api/mobile/accounts/cash-entries/summary?${sp.toString()}`);
}

export async function listContactsAction(branchId?: string) {
  const sp = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  return backendFetch(`/api/mobile/accounts/contacts${sp}`);
}

export async function listSuppliersAction(branchId?: string) {
  const sp = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  return backendFetch(`/api/mobile/accounts/suppliers${sp}`);
}

export async function getNextVoucherNumberAction() {
  return backendFetch<string>('/api/mobile/accounts/cash-entries/next-number');
}
