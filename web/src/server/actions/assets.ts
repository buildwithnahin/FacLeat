'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import {
  assetCreateSchema,
  assetUpdateSchema,
  assetTransferSchema,
  assetDisposeSchema,
  assetDepreciateSchema,
  assetDepreciateBulkSchema,
  assetMaintainSchema,
  assetCategorySchema,
} from '@/server/validators/assets';

export type AssetFormState =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }
  | undefined;

function parseAsset(formData: FormData) {
  return {
    branchId: formData.get('branchId'),
    categoryId: formData.get('categoryId') ?? '',
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    serialNumber: formData.get('serialNumber') ?? '',
    location: formData.get('location') ?? '',
    assignedTo: formData.get('assignedTo') ?? '',
    condition: formData.get('condition') ?? 'GOOD',
    status: formData.get('status') ?? 'IN_USE',
    purchaseDate: formData.get('purchaseDate'),
    purchaseCost: formData.get('purchaseCost'),
    salvageValue: formData.get('salvageValue') ?? 0,
    usefulLifeMonths: formData.get('usefulLifeMonths') ?? 60,
    depreciationMethod: formData.get('depreciationMethod') ?? 'STRAIGHT_LINE',
    notes: formData.get('notes') ?? '',
  };
}

export async function createAssetAction(
  _prev: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const parsed = assetCreateSchema.safeParse(parseAsset(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  let id: string;
  try {
    const asset = await backendFetch<{ id: string }>('/api/mobile/assets', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    id = asset.id;
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/assets');
  redirect(`/assets/${id}`);
}

export async function updateAssetAction(
  _prev: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const parsed = assetUpdateSchema.safeParse({
    id: formData.get('id'),
    ...parseAsset(formData),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/assets/${parsed.data.id}`, {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/assets/${parsed.data.id}`);
  redirect(`/assets/${parsed.data.id}`);
}

export async function transferAssetAction(
  _prev: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const parsed = assetTransferSchema.safeParse({
    assetId: formData.get('assetId'),
    toBranchId: formData.get('toBranchId') ?? '',
    toLocation: formData.get('toLocation') ?? '',
    toAssignee: formData.get('toAssignee') ?? '',
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/assets/${parsed.data.assetId}/transfer`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/assets/${parsed.data.assetId}`);
  return { success: true };
}

export async function disposeAssetAction(
  _prev: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const parsed = assetDisposeSchema.safeParse({
    assetId: formData.get('assetId'),
    disposalValue: formData.get('disposalValue') ?? 0,
    disposalReason: formData.get('disposalReason'),
    disposedAt: formData.get('disposedAt'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/assets/${parsed.data.assetId}/dispose`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/assets/${parsed.data.assetId}`);
  revalidatePath('/assets');
  return { success: true };
}

export async function depreciateAssetAction(
  _prev: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const parsed = assetDepreciateSchema.safeParse({
    assetId: formData.get('assetId'),
    periodEnd: formData.get('periodEnd'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/assets/${parsed.data.assetId}/depreciate`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/assets/${parsed.data.assetId}`);
  return { success: true };
}

export async function upsertAssetCategoryAction(
  _prev: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const id = formData.get('id');
  const parsed = assetCategorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    depreciationMethod: formData.get('depreciationMethod') ?? 'STRAIGHT_LINE',
    defaultLifeMonths: formData.get('defaultLifeMonths') ?? 60,
    defaultSalvageRate: formData.get('defaultSalvageRate') ?? 0,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch('/api/mobile/assets/categories', {
      method: 'POST',
      body: JSON.stringify({
        id: typeof id === 'string' && id ? id : undefined,
        ...parsed.data,
      }),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/assets/categories');
  return { success: true };
}

export async function maintainAssetAction(
  _prev: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const parsed = assetMaintainSchema.safeParse({
    assetId: formData.get('assetId'),
    cost: formData.get('cost') ?? 0,
    status: formData.get('status') ?? 'UNDER_MAINTENANCE',
    condition: formData.get('condition') || undefined,
    note: formData.get('note'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await backendFetch(`/api/mobile/assets/${parsed.data.assetId}/maintain`, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/assets/${parsed.data.assetId}`);
  revalidatePath('/assets');
  return { success: true };
}

export async function depreciateBulkAssetsAction(input: unknown) {
  const parsed = assetDepreciateBulkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const res = await backendFetch<{
      postedCount: number;
      totalExpense: string;
      assetsConsidered: number;
    }>('/api/mobile/assets/depreciate-bulk', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    });
    revalidatePath('/assets');
    return {
      success: true,
      postedCount: res.postedCount,
      totalExpense: res.totalExpense,
      assetsConsidered: res.assetsConsidered,
    };
  } catch (e) {
    if (e instanceof BackendApiError) return { error: e.message };
    throw e;
  }
}
