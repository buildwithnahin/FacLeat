'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  customerReturnInspectionSchema,
  customerReturnIntakeSchema,
  damageRejectSchema,
  damageReportSchema,
  damageResolutionSchema,
} from '@/server/validators/warehouse-workflows';

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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let created: { id: string };
  try {
    created = await backendFetch<{ id: string }>('/api/mobile/warehouse/returns', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }
  revalidatePath('/warehouse/returns');
  redirect(`/warehouse/returns/${created.id}`);
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let updated: { id: string };
  try {
    updated = await backendFetch<{ id: string }>(`/api/mobile/warehouse/returns/${parsed.data.id}/inspect`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }
  revalidatePath('/warehouse/returns');
  redirect(`/warehouse/returns/${updated.id}`);
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let created: { id: string };
  try {
    created = await backendFetch<{ id: string }>('/api/mobile/warehouse/damage-reports', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }
  revalidatePath('/warehouse/faulty');
  redirect(`/warehouse/faulty/${created.id}`);
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let updated: { id: string };
  try {
    updated = await backendFetch<{ id: string }>(`/api/mobile/warehouse/damage-reports/${parsed.data.id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }
  revalidatePath('/warehouse/faulty');
  redirect(`/warehouse/faulty/${updated.id}`);
}

export async function rejectDamageReportAction(
  _prev: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const parsed = damageRejectSchema.safeParse({
    id: formData.get('id'),
    resolutionNote: formData.get('resolutionNote') ?? '',
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let updated: { id: string };
  try {
    updated = await backendFetch<{ id: string }>(`/api/mobile/warehouse/damage-reports/${parsed.data.id}/reject`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (error instanceof BackendApiError) return { error: error.message };
    throw error;
  }
  revalidatePath('/warehouse/faulty');
  redirect(`/warehouse/faulty/${updated.id}`);
}
