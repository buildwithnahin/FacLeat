'use client';

import { useState, useActionState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createAssetAction,
  updateAssetAction,
  type AssetFormState,
} from '@/server/actions/assets';
import {
  ASSET_CONDITION,
  ASSET_STATUS,
  DEPRECIATION_METHODS,
} from '@/server/validators/assets';

type Branch = { id: string; name: string; code: string };
type Category = {
  id: string;
  name: string;
  depreciationMethod?: string;
  defaultLifeMonths?: number;
  defaultSalvageRate?: string | number;
};

type AssetDefaults = {
  id?: string;
  branchId?: string;
  categoryId?: string | null;
  name?: string;
  description?: string | null;
  serialNumber?: string | null;
  location?: string | null;
  assignedTo?: string | null;
  condition?: string;
  status?: string;
  purchaseDate?: string;
  purchaseCost?: string;
  salvageValue?: string;
  usefulLifeMonths?: number;
  depreciationMethod?: string;
  notes?: string | null;
};

export function AssetForm({
  mode,
  branches,
  categories,
  defaults,
}: {
  mode: 'create' | 'edit';
  branches: Branch[];
  categories: Category[];
  defaults?: AssetDefaults;
}) {
  const action = mode === 'create' ? createAssetAction : updateAssetAction;
  const [state, submit, pending] = useActionState<AssetFormState, FormData>(action, undefined);
  const fieldErrors = state?.fieldErrors ?? {};

  // Form states with auto-fill assist
  const [selectedCatId, setSelectedCatId] = useState(defaults?.categoryId ?? '');
  const [usefulLife, setUsefulLife] = useState<number | string>(defaults?.usefulLifeMonths ?? 60);
  const [deprMethod, setDeprMethod] = useState(defaults?.depreciationMethod ?? 'STRAIGHT_LINE');
  const [purchaseCost, setPurchaseCost] = useState(defaults?.purchaseCost ?? '');
  const [salvageVal, setSalvageVal] = useState(defaults?.salvageValue ?? '0');

  const handleCategoryChange = (catId: string) => {
    setSelectedCatId(catId);
    if (!catId) return;
    const cat = categories.find((c) => c.id === catId);
    if (cat && mode === 'create') {
      if (cat.defaultLifeMonths) setUsefulLife(cat.defaultLifeMonths);
      if (cat.depreciationMethod) setDeprMethod(cat.depreciationMethod);
      if (cat.defaultSalvageRate && purchaseCost) {
        const rate = Number(cat.defaultSalvageRate) || 0;
        const cost = Number(purchaseCost) || 0;
        setSalvageVal((cost * rate).toFixed(2));
      }
    }
  };

  const handleCostChange = (val: string) => {
    setPurchaseCost(val);
    if (mode === 'create' && selectedCatId) {
      const cat = categories.find((c) => c.id === selectedCatId);
      if (cat?.defaultSalvageRate) {
        const rate = Number(cat.defaultSalvageRate) || 0;
        const cost = Number(val) || 0;
        setSalvageVal((cost * rate).toFixed(2));
      }
    }
  };

  return (
    <form action={submit} className="space-y-6">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}
      <Card className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Branch *</Label>
          <select
            name="branchId"
            defaultValue={defaults?.branchId ?? branches[0]?.id ?? ''}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Category</Label>
          <select
            name="categoryId"
            value={selectedCatId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          >
            <option value="">— Select Category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <Label>Asset Name *</Label>
          <Input
            name="name"
            placeholder="e.g. Industrial Leather Splitting Machine, Mac Studio M2"
            defaultValue={defaults?.name ?? ''}
            required
          />
        </div>
        <div className="md:col-span-2">
          <Label>Description</Label>
          <Textarea
            name="description"
            placeholder="Model specifications, vendor notes..."
            defaultValue={defaults?.description ?? ''}
            rows={2}
          />
        </div>
        <div>
          <Label>Serial / Tag Number</Label>
          <Input
            name="serialNumber"
            placeholder="e.g. SN-892301"
            defaultValue={defaults?.serialNumber ?? ''}
          />
        </div>
        <div>
          <Label>Physical Location</Label>
          <Input
            name="location"
            placeholder="e.g. Factory Floor 1, Showroom 2, Head Office"
            defaultValue={defaults?.location ?? ''}
          />
        </div>
        <div>
          <Label>Assigned To (Custodian)</Label>
          <Input
            name="assignedTo"
            placeholder="e.g. Production Manager, IT Dept"
            defaultValue={defaults?.assignedTo ?? ''}
          />
        </div>
        <div>
          <Label>Physical Condition</Label>
          <select
            name="condition"
            defaultValue={defaults?.condition ?? 'GOOD'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          >
            {ASSET_CONDITION.map((c) => (
              <option key={c} value={c}>
                {c.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Operational Status</Label>
          <select
            name="status"
            defaultValue={defaults?.status ?? 'IN_USE'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          >
            {ASSET_STATUS.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Purchase Date *</Label>
          <Input
            type="date"
            name="purchaseDate"
            defaultValue={defaults?.purchaseDate ?? new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <div>
          <Label>Purchase Cost (BDT) *</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            name="purchaseCost"
            placeholder="0.00"
            value={purchaseCost}
            onChange={(e) => handleCostChange(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Salvage / Residual Value (BDT)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            name="salvageValue"
            value={salvageVal}
            onChange={(e) => setSalvageVal(e.target.value)}
          />
        </div>
        <div>
          <Label>Useful Life (Months)</Label>
          <Input
            type="number"
            min="1"
            name="usefulLifeMonths"
            value={usefulLife}
            onChange={(e) => setUsefulLife(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Label>Depreciation Method</Label>
          <select
            name="depreciationMethod"
            value={deprMethod}
            onChange={(e) => setDeprMethod(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          >
            {DEPRECIATION_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <Label>Notes & Warranty Details</Label>
          <Textarea
            name="notes"
            placeholder="Warranty period, supplier contact, maintenance schedule..."
            defaultValue={defaults?.notes ?? ''}
            rows={2}
          />
        </div>
      </Card>

      {state?.error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {Object.entries(fieldErrors).map(([k, v]) => (
        <p key={k} className="text-xs text-red-600">
          {k}: {v?.join(', ')}
        </p>
      ))}

      <div className="flex justify-end gap-2">
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create Asset' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
