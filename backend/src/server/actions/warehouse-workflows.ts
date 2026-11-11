'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { warehouseWorkflowService } from '@/server/services/warehouse-workflows.service';
import {
  customerReturnInspectionSchema,
  customerReturnIntakeSchema,
  damageRejectSchema,
  damageReportSchema,
  damageResolutionSchema,
} from '@/server/validators/warehouse-workflows';
import { ApiError } from '@/lib/errors';

export type WorkflowFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

function parseItemsJson(formData: FormData) {
  const raw = String(formData.get('itemsJson') ?? '[]');
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function parseDecisionItemsJson(formData: FormData) {
  const raw = String(formData.get('decisionItemsJson') ?? '[]');
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function createCustomerReturnAction(
  _prev: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const parsed = customerReturnIntakeSchema.safeParse({
    branchId: formData.get('branchId'),
    warehouseId: formData.get('warehouseId'),
    sourceDocumentType: formData.get('sourceDocumentType') ?? '',
    sourceDocumentNumber: formData.get('sourceDocumentNumber') ?? '',
    customerName: formData.get('customerName') ?? '',
    customerPhone: formData.get('customerPhone') ?? '',
    financeAction: formData.get('financeAction') ?? 'NONE',
    financeNote: formData.get('financeNote') ?? '',
    intakeNote: formData.get('intakeNote') ?? '',
    items: parseItemsJson(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    const created = await warehouseWorkflowService.intakeCustomerReturn(session, parsed.data);
    revalidatePath('/warehouse/returns');
    redirect(`/warehouse/returns/${created.id}`);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function inspectCustomerReturnAction(
  _prev: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const parsed = customerReturnInspectionSchema.safeParse({
    id: formData.get('id'),
    financeAction: formData.get('financeAction') ?? 'NONE',
    financeNote: formData.get('financeNote') ?? '',
    inspectionNote: formData.get('inspectionNote') ?? '',
    items: parseDecisionItemsJson(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    const updated = await warehouseWorkflowService.inspectCustomerReturn(session, parsed.data);
    revalidatePath('/warehouse/returns');
    redirect(`/warehouse/returns/${updated.id}`);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function createDamageReportAction(
  _prev: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const parsed = damageReportSchema.safeParse({
    branchId: formData.get('branchId'),
    warehouseId: formData.get('warehouseId'),
    reason: formData.get('reason') ?? '',
    note: formData.get('note') ?? '',
    items: parseItemsJson(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    const created = await warehouseWorkflowService.reportDamage(session, parsed.data);
    revalidatePath('/warehouse/faulty');
    redirect(`/warehouse/faulty/${created.id}`);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function resolveDamageReportAction(
  _prev: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const parsed = damageResolutionSchema.safeParse({
    id: formData.get('id'),
    resolution: formData.get('resolution'),
    supplierId: formData.get('supplierId') ?? '',
    grnId: formData.get('grnId') ?? '',
    purchaseInvoiceId: formData.get('purchaseInvoiceId') ?? '',
    claimAmount: formData.get('claimAmount') ?? '0',
    claimReference: formData.get('claimReference') ?? '',
    resolutionNote: formData.get('resolutionNote') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    const updated = await warehouseWorkflowService.resolveDamageReport(session, parsed.data);
    revalidatePath('/warehouse/faulty');
    redirect(`/warehouse/faulty/${updated.id}`);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function rejectDamageReportAction(
  _prev: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const parsed = damageRejectSchema.safeParse({
    id: formData.get('id'),
    resolutionNote: formData.get('resolutionNote') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  try {
    const session = await getSession();
    const updated = await warehouseWorkflowService.rejectDamageReport(session, parsed.data);
    revalidatePath('/warehouse/faulty');
    redirect(`/warehouse/faulty/${updated.id}`);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
