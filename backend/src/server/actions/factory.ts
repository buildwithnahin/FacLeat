'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { factoryService } from '@/server/services/factory.service';
import { factoryWorkflowService } from '@/server/services/factory-workflow.service';
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
import { ApiError } from '@/lib/errors';

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
  const buyerName = formData.get('buyerName');
  const batchName = formData.get('batchName');
  const saleAmountRaw = formData.get('saleAmount');

  const parsed = productionOrderCreateSchema.safeParse({
    branchId: formData.get('branchId'),
    productId: formData.get('productId'),
    planId: formData.get('planId') ?? '',
    plannedQty: formData.get('plannedQty'),
    unit: formData.get('unit') ?? 'PCS',
    plannedStartDate: formData.get('plannedStartDate'),
    plannedEndDate: formData.get('plannedEndDate'),
    notes: formData.get('notes') ?? '',
    buyerName: typeof buyerName === 'string' && buyerName ? buyerName : undefined,
    batchName: typeof batchName === 'string' && batchName ? batchName : undefined,
    saleAmount: saleAmountRaw ? Number(saleAmountRaw) : undefined,
    materials: parseJson(formData.get('materials'), []),
    stages: parseJson(formData.get('stages'), []),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (parsed.data.plannedEndDate < parsed.data.plannedStartDate) {
    return {
      error: 'Planned end date cannot be before planned start date',
      fieldErrors: { plannedEndDate: ['Planned end date cannot be before planned start date'] },
    };
  }

  let orderId: string | null = null;
  try {
    const session = await getSession();
    const order = await factoryService.create(session, parsed.data);
    orderId = order.id;
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/factory');
  redirect(`/factory/${orderId}`);
}

export async function consumeMaterialsAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const parsed = productionConsumeSchema.safeParse({
    orderId: formData.get('orderId'),
    items: parseJson(formData.get('items'), []),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryService.consumeMaterials(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryService.recordOutput(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryService.updateStage(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  const orderId = formData.get('orderId');
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryService.updateStatus(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryService.addCostEntry(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryService.deleteCostEntry(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryService.updateOverheadRate(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryWorkflowService.createProductionIssue(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
  const session = await getSession();
  try {
    await factoryWorkflowService.changeProductionIssueStatus(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return;
    throw e;
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryWorkflowService.saveProcessTracking(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/factory/process-tracking');
  return { success: true };
}

export async function createProductionReceiveAction(
  _prev: FactoryFormState,
  formData: FormData,
): Promise<FactoryFormState> {
  const fromStageId = formData.get('fromStageId');
  const toStageId = formData.get('toStageId');
  if (fromStageId && toStageId && fromStageId === toStageId) {
    return {
      error: 'From stage and To stage cannot be the same',
      fieldErrors: { toStageId: ['From stage and To stage cannot be the same'] },
    };
  }

  const parsed = productionReceiveCreateSchema.safeParse({
    date: formData.get('date'),
    orderId: formData.get('orderId'),
    fromStageId,
    toStageId,
    productId: formData.get('productId'),
    receivedQty: formData.get('receivedQty'),
    rejectedQty: formData.get('rejectedQty') ?? 0,
    scrapQty: formData.get('scrapQty') ?? 0,
    operatorId: formData.get('operatorId') ?? '',
    remarks: formData.get('remarks') ?? '',
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryWorkflowService.createProductionReceive(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const session = await getSession();
    await factoryWorkflowService.createFinishedGoodsReceive(session, parsed.data);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (parsed.data.plannedEndDate < parsed.data.plannedStartDate) {
    return {
      error: 'Planned end date cannot be before planned start date',
      fieldErrors: { plannedEndDate: ['Planned end date cannot be before planned start date'] },
    };
  }

  let planId: string | null = null;
  try {
    const session = await getSession();
    const plan = await factoryService.createPlan(session, parsed.data);
    planId = plan.id;
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
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
  const session = await getSession();
  try {
    await factoryService.decidePlan(session, parsed.data);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
  }
  revalidatePath('/factory/planning');
  revalidatePath(`/factory/planning/${parsed.data.id}`);
}
