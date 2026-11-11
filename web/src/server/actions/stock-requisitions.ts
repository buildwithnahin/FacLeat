'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  stockDispatchCreateSchema,
  stockRequisitionAssignSchema,
  stockRequisitionCreateSchema,
  stockRequisitionDecisionSchema,
  stockTransferReceiveSchema,
  stockTransferStatusSchema,
} from '@/server/validators/stock-requisitions';

export type StockRequisitionFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

function parseJsonArray(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? '[]');
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function fail(error: unknown): StockRequisitionFormState {
  if (error instanceof BackendApiError) return { error: error.message };
  throw error;
}

export async function createStockRequisitionAction(
  _prev: StockRequisitionFormState,
  formData: FormData,
): Promise<StockRequisitionFormState> {
  const parsed = stockRequisitionCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    showroomWarehouseId: formData.get('showroomWarehouseId'),
    priority: formData.get('priority') ?? 'MEDIUM',
    requiredDate: formData.get('requiredDate'),
    remarks: formData.get('remarks') ?? '',
    items: parseJsonArray(formData, 'itemsJson'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const created = await backendFetch<{ id: string }>('/api/mobile/warehouse/requisitions', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath('/warehouse/requisitions');
    redirect(`/warehouse/requisitions/${created.id}`);
  } catch (error) {
    return fail(error);
  }
}

export async function decideStockRequisitionAction(
  _prev: StockRequisitionFormState,
  formData: FormData,
): Promise<StockRequisitionFormState> {
  const parsed = stockRequisitionDecisionSchema.safeParse({
    requisitionId: formData.get('requisitionId'),
    decision: formData.get('decision'),
    sourceWarehouseId: formData.get('sourceWarehouseId') ?? '',
    approvalNote: formData.get('approvalNote') ?? '',
    rejectionReason: formData.get('rejectionReason') ?? '',
    items: parseJsonArray(formData, 'itemsJson'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await backendFetch<{ id: string }>(
      `/api/mobile/warehouse/requisitions/${parsed.data.requisitionId}/decide`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/warehouse/requisitions');
    revalidatePath(`/warehouse/requisitions/${updated.id}`);
    redirect(`/warehouse/requisitions/${updated.id}`);
  } catch (error) {
    return fail(error);
  }
}

export async function assignStockRequisitionWarehouseAction(
  _prev: StockRequisitionFormState,
  formData: FormData,
): Promise<StockRequisitionFormState> {
  const parsed = stockRequisitionAssignSchema.safeParse({
    requisitionId: formData.get('requisitionId'),
    sourceWarehouseId: formData.get('sourceWarehouseId'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await backendFetch<{ id: string }>(
      `/api/mobile/warehouse/requisitions/${parsed.data.requisitionId}/assign-warehouse`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/warehouse/requisitions');
    revalidatePath(`/warehouse/requisitions/${updated.id}`);
    redirect(`/warehouse/requisitions/${updated.id}`);
  } catch (error) {
    return fail(error);
  }
}

export async function createStockDispatchAction(
  _prev: StockRequisitionFormState,
  formData: FormData,
): Promise<StockRequisitionFormState> {
  const parsed = stockDispatchCreateSchema.safeParse({
    requisitionId: formData.get('requisitionId'),
    expectedDate: formData.get('expectedDate') || undefined,
    packedBy: formData.get('packedBy') ?? '',
    vehicle: formData.get('vehicle') ?? '',
    driverName: formData.get('driverName') ?? '',
    driverPhone: formData.get('driverPhone') ?? '',
    gatePassNo: formData.get('gatePassNo') ?? '',
    trackingNo: formData.get('trackingNo') ?? '',
    remarks: formData.get('remarks') ?? '',
    items: parseJsonArray(formData, 'itemsJson'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const transfer = await backendFetch<{ id: string; requisitionId: string }>(
      `/api/mobile/warehouse/requisitions/${parsed.data.requisitionId}/dispatch`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/warehouse/requisitions/dispatch');
    revalidatePath(`/warehouse/requisitions/${transfer.requisitionId}`);
    redirect(`/warehouse/requisitions/${transfer.requisitionId}`);
  } catch (error) {
    return fail(error);
  }
}

export async function updateStockTransferStatusAction(
  _prev: StockRequisitionFormState,
  formData: FormData,
): Promise<StockRequisitionFormState> {
  const parsed = stockTransferStatusSchema.safeParse({
    transferId: formData.get('transferId'),
    status: formData.get('status'),
    dispatchNote: formData.get('dispatchNote') ?? '',
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await backendFetch<{ id: string; requisitionId: string }>(
      `/api/mobile/warehouse/transfers/${parsed.data.transferId}/status`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/warehouse/requisitions/dispatch');
    revalidatePath('/warehouse/requisitions/receive');
    revalidatePath(`/warehouse/requisitions/${updated.requisitionId}`);
    redirect(`/warehouse/requisitions/${updated.requisitionId}`);
  } catch (error) {
    return fail(error);
  }
}

export async function receiveStockTransferAction(
  _prev: StockRequisitionFormState,
  formData: FormData,
): Promise<StockRequisitionFormState> {
  const parsed = stockTransferReceiveSchema.safeParse({
    transferId: formData.get('transferId'),
    receiveRemarks: formData.get('receiveRemarks') ?? '',
    items: parseJsonArray(formData, 'itemsJson'),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await backendFetch<{ id: string; requisitionId: string }>(
      `/api/mobile/warehouse/transfers/${parsed.data.transferId}/receive`,
      { method: 'POST', body: JSON.stringify(parsed.data) },
    );
    revalidatePath('/warehouse/requisitions/receive');
    revalidatePath(`/warehouse/requisitions/${updated.requisitionId}`);
    redirect(`/warehouse/requisitions/${updated.requisitionId}`);
  } catch (error) {
    return fail(error);
  }
}
