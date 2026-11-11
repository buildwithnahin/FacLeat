'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { runDecisionAndRedirect } from '@/lib/decision-notice';
import {
  productionOrderCreateSchema,
  productionConsumeSchema,
  productionOutputSchema,
  productionStageUpdateSchema,
  productionOrderStatusSchema,
  productionCostEntryCreateSchema,
  productionCostEntryDeleteSchema,
  productionOverheadRateSchema,
  productionIssueCreateSchema,
  productionIssueStatusSchema,
  processTrackingCreateSchema,
  productionReceiveCreateSchema,
  finishedGoodsReceiveCreateSchema,
  productionPlanCreateSchema,
  productionPlanDecisionSchema,
} from '@/server/validators/factory';

export type FactoryFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | undefined;

function parseJson<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function createProductionOrderAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionOrderCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    productId: formData.get('productId'),
    planId: formData.get('planId') ?? '',
    plannedQty: formData.get('plannedQty'),
    unit: formData.get('unit') ?? 'PCS',
    plannedStartDate: formData.get('plannedStartDate'),
    plannedEndDate: formData.get('plannedEndDate'),
    notes: formData.get('notes') ?? '',
    materials: parseJson(formData.get('materials'), []),
    stages: parseJson(formData.get('stages'), []),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  let orderId: string;
  try {
    const order = await backendFetch<{ id: string }>('/api/mobile/factory', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    orderId = order.id;
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/factory');
  redirect(`/factory/${orderId}`);
}

export async function consumeMaterialsAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const orderId = formData.get('orderId');
  const parsed = productionConsumeSchema.safeParse({
    orderId,
    items: parseJson(formData.get('items'), []),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/factory/${parsed.data.orderId}/consume`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/factory/${parsed.data.orderId}`);
  return { success: true };
}

export async function recordOutputAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionOutputSchema.safeParse({
    orderId: formData.get('orderId'),
    quantity: formData.get('quantity'),
    costPerUnit: formData.get('costPerUnit') ?? 0,
    toWarehouseId: formData.get('toWarehouseId'),
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/factory/${parsed.data.orderId}/output`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/factory/${parsed.data.orderId}`);
  return { success: true };
}

export async function updateStageAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionStageUpdateSchema.safeParse({
    stageId: formData.get('stageId'),
    status: formData.get('status'),
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const orderId = formData.get('orderId');
  try {
    await backendFetch(`/api/mobile/factory/${orderId}/stages/${parsed.data.stageId}`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  if (typeof orderId === 'string') revalidatePath(`/factory/${orderId}`);
  return { success: true };
}

export async function updateOrderStatusAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionOrderStatusSchema.safeParse({
    orderId: formData.get('orderId'),
    status: formData.get('status'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/factory/${parsed.data.orderId}/status`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/factory/${parsed.data.orderId}`);
  revalidatePath('/factory');
  return { success: true };
}

export async function addCostEntryAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionCostEntryCreateSchema.safeParse({
    orderId: formData.get('orderId'),
    type: formData.get('type'),
    description: formData.get('description'),
    hours: formData.get('hours') ?? undefined,
    rate: formData.get('rate') ?? undefined,
    amount: formData.get('amount') ?? undefined,
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/factory/${parsed.data.orderId}/cost-entries`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/factory/${parsed.data.orderId}`);
  return { success: true };
}

export async function deleteCostEntryAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionCostEntryDeleteSchema.safeParse({
    entryId: formData.get('entryId'),
    orderId: formData.get('orderId'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/factory/${parsed.data.orderId}/cost-entries/${parsed.data.entryId}`, {
      method: 'DELETE',
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/factory/${parsed.data.orderId}`);
  return { success: true };
}

export async function updateOverheadRateAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionOverheadRateSchema.safeParse({
    orderId: formData.get('orderId'),
    overheadRate: formData.get('overheadRate'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/factory/${parsed.data.orderId}/overhead-rate`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/factory/${parsed.data.orderId}`);
  return { success: true };
}

export async function createProductionIssueAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionIssueCreateSchema.safeParse({
    orderId: formData.get('orderId'),
    date: formData.get('date'),
    warehouseId: formData.get('warehouseId'),
    remarks: formData.get('remarks') ?? '',
    items: parseJson(formData.get('items'), []),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/factory/production-issue', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/factory/production-issue');
  return { success: true };
}

export async function updateProductionIssueStatusAction(formData: FormData) {
  const parsed = productionIssueStatusSchema.safeParse({
    voucherId: formData.get('voucherId'),
    status: formData.get('status'),
  });
  if (!parsed.success) return;
  try {
    await backendFetch(`/api/mobile/factory/production-issue/${parsed.data.voucherId}/status`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (!(e instanceof BackendApiError)) throw e;
  }
  revalidatePath('/factory/production-issue');
}

export async function saveProcessTrackingAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = processTrackingCreateSchema.safeParse({
    trackingId: formData.get('trackingId') ?? '',
    orderId: formData.get('orderId'),
    productId: formData.get('productId'),
    stageId: formData.get('stageId'),
    operatorId: formData.get('operatorId') ?? '',
    machine: formData.get('machine') ?? '',
    batchNo: formData.get('batchNo') ?? '',
    inputQty: formData.get('inputQty') ?? 0,
    outputQty: formData.get('outputQty') ?? 0,
    rejectedQty: formData.get('rejectedQty') ?? 0,
    scrapQty: formData.get('scrapQty') ?? 0,
    reworkQty: formData.get('reworkQty') ?? 0,
    startTime: formData.get('startTime') ?? '',
    endTime: formData.get('endTime') ?? '',
    status: formData.get('status'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/factory/process-tracking', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/factory/process-tracking');
  return { success: true };
}

export async function createProductionReceiveAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionReceiveCreateSchema.safeParse({
    date: formData.get('date'),
    orderId: formData.get('orderId'),
    fromStageId: formData.get('fromStageId'),
    toStageId: formData.get('toStageId'),
    productId: formData.get('productId'),
    receivedQty: formData.get('receivedQty'),
    rejectedQty: formData.get('rejectedQty') ?? 0,
    scrapQty: formData.get('scrapQty') ?? 0,
    operatorId: formData.get('operatorId') ?? '',
    remarks: formData.get('remarks') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/factory/production-receive', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/factory/production-receive');
  return { success: true };
}

export async function createFinishedGoodsReceiveAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = finishedGoodsReceiveCreateSchema.safeParse({
    date: formData.get('date'),
    orderId: formData.get('orderId'),
    warehouseId: formData.get('warehouseId'),
    sourceStageId: formData.get('sourceStageId') ?? '',
    remarks: formData.get('remarks') ?? '',
    items: parseJson(formData.get('items'), []),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/factory/finished-goods-receive', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/factory/finished-goods-receive');
  return { success: true };
}

// ─── Production Plan ────────────────────────────────────────────────────────

export async function createProductionPlanAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionPlanCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    productId: formData.get('productId'),
    quantity: formData.get('quantity'),
    planningDate: formData.get('planningDate'),
    plannedStartDate: formData.get('plannedStartDate'),
    plannedEndDate: formData.get('plannedEndDate'),
    priority: formData.get('priority') ?? 'MEDIUM',
    productionLine: formData.get('productionLine') ?? '',
    machine: formData.get('machine') ?? '',
    shift: formData.get('shift') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  let planId: string;
  try {
    const plan = await backendFetch<{ id: string }>('/api/mobile/factory/planning', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    planId = plan.id;
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/factory/planning');
  redirect(`/factory/planning/${planId}`);
}

export async function decideProductionPlanAction(formData: FormData) {
  const parsed = productionPlanDecisionSchema.safeParse({
    id: formData.get('id'),
    decision: formData.get('decision'),
  });
  if (!parsed.success) throw new Error('Invalid decision payload');
  await runDecisionAndRedirect(
    () =>
      backendFetch(`/api/mobile/factory/planning/${parsed.data.id}/decision`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      }),
    `/factory/planning/${parsed.data.id}`,
    '/factory/planning',
  );
}
