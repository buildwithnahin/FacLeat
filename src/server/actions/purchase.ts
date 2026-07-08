'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { purchaseService } from '@/server/services/purchase.service';
import {
  requisitionCreateSchema,
  requisitionDecisionSchema,
  poCreateSchema,
  grnCreateSchema,
  invoiceCreateSchema,
  debitNoteCreateSchema,
} from '@/server/validators/purchase';
import { ApiError } from '@/lib/errors';

export type PurchaseFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

/** The client form JSON-stringifies `items` before submitting. */
function parseItems(formData: FormData): unknown {
  const raw = formData.get('itemsJson');
  if (typeof raw !== 'string' || !raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ─── PR ─────────────────────────────────────────────────────────────────────

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
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
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

// ─── PO ─────────────────────────────────────────────────────────────────────

export async function createPurchaseOrderAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const parsed = poCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    supplierId: formData.get('supplierId'),
    requisitionId: formData.get('requisitionId') ?? '',
    deliveryDate: formData.get('deliveryDate'),
    orderDate: formData.get('orderDate') ?? undefined,
    currency: formData.get('currency') ?? 'BDT',
    notes: formData.get('notes') ?? '',
    items: parseItems(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const session = await getSession();
    await purchaseService.createPurchaseOrder(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/orders');
  redirect('/purchase/orders');
}

export async function approvePurchaseOrderAction(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') throw new Error('Invalid PO id');
  const session = await getSession();
  try {
    await purchaseService.approvePurchaseOrder(session, id);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  revalidatePath('/purchase/orders');
  revalidatePath(`/purchase/orders/${id}`);
}

export async function cancelPurchaseOrderAction(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') throw new Error('Invalid PO id');
  const session = await getSession();
  await purchaseService.cancelPurchaseOrder(session, id);
  revalidatePath('/purchase/orders');
  revalidatePath(`/purchase/orders/${id}`);
}

// ─── GRN ────────────────────────────────────────────────────────────────────

export async function createGrnAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const parsed = grnCreateSchema.safeParse({
    purchaseOrderId: formData.get('purchaseOrderId'),
    warehouseId: formData.get('warehouseId'),
    receivedDate: formData.get('receivedDate'),
    notes: formData.get('notes') ?? '',
    items: parseItems(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const session = await getSession();
    await purchaseService.createGrn(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/grn');
  revalidatePath(`/purchase/orders/${parsed.data.purchaseOrderId}`);
  redirect('/purchase/grn');
}

// ─── Invoice ────────────────────────────────────────────────────────────────

export async function createInvoiceAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const parsed = invoiceCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    supplierId: formData.get('supplierId'),
    purchaseOrderId: formData.get('purchaseOrderId') ?? '',
    grnId: formData.get('grnId') ?? '',
    invoiceDate: formData.get('invoiceDate'),
    dueDate: formData.get('dueDate'),
    currency: formData.get('currency') ?? 'BDT',
    discountTotal: formData.get('discountTotal') ?? 0,
    notes: formData.get('notes') ?? '',
    items: parseItems(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const session = await getSession();
    await purchaseService.createInvoice(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/invoices');
  redirect('/purchase/invoices');
}

export async function approveInvoiceAction(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') throw new Error('Invalid invoice id');
  const session = await getSession();
  try {
    await purchaseService.approveInvoice(session, id);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  revalidatePath('/purchase/invoices');
  revalidatePath(`/purchase/invoices/${id}`);
}

// ─── Debit Note (Purchase Return) ──────────────────────────────────────────

export async function createDebitNoteAction(
  _prev: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const parsed = debitNoteCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    supplierId: formData.get('supplierId'),
    warehouseId: formData.get('warehouseId'),
    invoiceId: formData.get('invoiceId') ?? '',
    grnId: formData.get('grnId') ?? '',
    returnDate: formData.get('returnDate'),
    reason: formData.get('reason') ?? '',
    vatAdjustment: formData.get('vatAdjustment') ?? 0,
    items: parseItems(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const session = await getSession();
    await purchaseService.createDebitNote(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/purchase/returns');
  redirect('/purchase/returns');
}
