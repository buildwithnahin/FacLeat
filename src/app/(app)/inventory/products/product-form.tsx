'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  createProductAction,
  updateProductAction,
  type ProductFormState,
} from '@/server/actions/products';

const PRODUCT_TYPES = [
  ['RAW_MATERIAL', 'Raw material'],
  ['WORK_IN_PROGRESS', 'Work in progress'],
  ['FINISHED_GOOD', 'Finished good'],
  ['CONSUMABLE', 'Consumable'],
  ['SERVICE', 'Service'],
] as const;

const UNITS = ['PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET'] as const;

export interface ProductFormProps {
  mode: 'create' | 'edit';
  initial?: {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    description: string | null;
    size: string | null;
    type: (typeof PRODUCT_TYPES)[number][0];
    unit: (typeof UNITS)[number];
    categoryId: string | null;
    brandId: string | null;
    costPrice: string;
    sellPrice: string;
    taxRate: string;
    reorderLevel: string;
    reorderQty: string;
    isActive: boolean;
    imageUrl: string | null;
  };
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
}

export function ProductForm({ mode, initial, categories, brands }: ProductFormProps) {
  const action = mode === 'create' ? createProductAction : updateProductAction;
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(action, undefined);
  const initialBarcodeMode = initial?.barcode ? 'manual' : 'generate';
  const [barcodeMode, setBarcodeMode] = useState<'generate' | 'manual'>(initialBarcodeMode);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const shoeCategoryIds = useMemo(
    () => new Set(categories.filter((category) => category.name.trim().toLowerCase() === 'shoes').map((category) => category.id)),
    [categories],
  );
  const isShoesCategory = shoeCategoryIds.has(categoryId);

  const E = (field: string) => state?.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sku">
              SKU <span className="text-destructive">*</span>
            </Label>
            <Input id="sku" name="sku" required defaultValue={initial?.sku} placeholder="e.g. LSR-BRN-001" />
            {E('sku') && <p className="text-xs text-destructive">{E('sku')}</p>}
          </div>
          <div className="space-y-2">
            <Label>Barcode</Label>
            <input type="hidden" name="barcodeMode" value={barcodeMode} />
            <div className="rounded-md border p-3 space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="barcodeModeUi"
                  checked={barcodeMode === 'generate'}
                  onChange={() => setBarcodeMode('generate')}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="font-medium">Auto-generate barcode</span>
                  <span className="block text-xs text-muted-foreground">
                    The system will create a unique barcode when the product is saved.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="barcodeModeUi"
                  checked={barcodeMode === 'manual'}
                  onChange={() => setBarcodeMode('manual')}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="font-medium">Enter barcode manually</span>
                  <span className="block text-xs text-muted-foreground">
                    Use this if you already have supplier or printed barcode values.
                  </span>
                </span>
              </label>
              <Input
                id="barcode"
                name="barcode"
                defaultValue={initial?.barcode ?? ''}
                disabled={barcodeMode !== 'manual'}
                placeholder={barcodeMode === 'manual' ? 'Enter barcode value' : 'Will be generated automatically'}
              />
            </div>
            {E('barcode') && <p className="text-xs text-destructive">{E('barcode')}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" required defaultValue={initial?.name} />
            {E('name') && <p className="text-xs text-destructive">{E('name')}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} defaultValue={initial?.description ?? ''} />
          </div>
          <SelectField label="Type" name="type" defaultValue={initial?.type ?? 'FINISHED_GOOD'}>
            {PRODUCT_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Unit" name="unit" defaultValue={initial?.unit ?? 'PCS'}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Category"
            name="categoryId"
            defaultValue={initial?.categoryId ?? ''}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <div className="space-y-2">
            <Label htmlFor="size">
              Size {isShoesCategory && <span className="text-destructive">*</span>}
            </Label>
            {isShoesCategory ? (
              <Input id="size" name="size" defaultValue={initial?.size ?? ''} placeholder="e.g. 9, 10, 11" required />
            ) : (
              <>
                <input type="hidden" name="size" value="" />
                <Input id="size" value="" placeholder="Available when category is Shoes" disabled readOnly />
              </>
            )}
            {E('size') && <p className="text-xs text-destructive">{E('size')}</p>}
          </div>
          <SelectField label="Brand" name="brandId" defaultValue={initial?.brandId ?? ''}>
            <option value="">— none —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <MoneyField label="Cost price" name="costPrice" defaultValue={initial?.costPrice ?? '0'} error={E('costPrice')} />
          <MoneyField label="Sell price" name="sellPrice" defaultValue={initial?.sellPrice ?? '0'} error={E('sellPrice')} />
          <MoneyField label="Tax rate (%)" name="taxRate" defaultValue={initial?.taxRate ?? '0'} error={E('taxRate')} />
          <MoneyField label="Reorder level" name="reorderLevel" defaultValue={initial?.reorderLevel ?? '0'} />
          <MoneyField label="Reorder quantity" name="reorderQty" defaultValue={initial?.reorderQty ?? '0'} />
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input id="imageUrl" name="imageUrl" type="url" defaultValue={initial?.imageUrl ?? ''} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={initial?.isActive ?? true}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">Active (available for transactions)</span>
          </label>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create product' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/inventory/products">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        onChange={onChange}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
      >
        {children}
      </select>
    </div>
  );
}

function MoneyField({
  label,
  name,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  defaultValue: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="text"
        inputMode="decimal"
        defaultValue={defaultValue}
        className="tabular"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
