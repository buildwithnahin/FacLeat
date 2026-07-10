'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { createDebitNoteAction, type PurchaseFormState } from '@/server/actions/purchase';
import { formatCurrency } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';

const UNITS = ['PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET'] as const;
const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm';

interface Row {
  key: string;
  productId: string;
  returnedQty: string;
  unitPrice: string;
  reason: string;
  condition: string;
}

function newRow(): Row {
  return {
    key: `r-${Math.random().toString(36).slice(2, 8)}`,
    productId: '',
    returnedQty: '',
    unitPrice: '',
    reason: '',
    condition: '',
  };
}

export interface ProductOption {
  id: string;
  sku: string;
  name: string;
  unit: string;
  costPrice: string;
}

export interface SupplierOption {
  id: string;
  code: string;
  name: string;
  branchId: string;
  currency: string;
}

export interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  branchId: string;
}

export interface BranchOption {
  id: string;
  name: string;
  code: string;
  currency: string;
}

interface Props {
  branches: BranchOption[];
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  products: ProductOption[];
  prefill?: { supplierId: string; invoiceId: string; grnId: string };
}

export function DebitNoteForm({ branches, suppliers, warehouses, products, prefill }: Props) {
  const [state, formAction, pending] = useActionState<PurchaseFormState, FormData>(
    createDebitNoteAction,
    undefined,
  );
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [supplierId, setSupplierId] = useState<string>(
    prefill?.supplierId || suppliers[0]?.id || '',
  );
  const supplier = suppliers.find((s) => s.id === supplierId);
  const branchId = supplier?.branchId ?? branches[0]?.id ?? '';
  const currency = (supplier?.currency ?? 'BDT') as CurrencyCode;
  const branchWarehouses = warehouses.filter((w) => w.branchId === branchId);
  const [warehouseId, setWarehouseId] = useState<string>(branchWarehouses[0]?.id ?? '');

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const r of rows) {
      subtotal += (Number(r.returnedQty) || 0) * (Number(r.unitPrice) || 0);
    }
    return { subtotal };
  }, [rows]);

  const E = (f: string) => state?.fieldErrors?.[f]?.[0];

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="branchId" value={branchId} />
      {prefill?.invoiceId && <input type="hidden" name="invoiceId" value={prefill.invoiceId} />}
      {prefill?.grnId && <input type="hidden" name="grnId" value={prefill.grnId} />}
      <input
        type="hidden"
        name="itemsJson"
        value={JSON.stringify(
          rows
            .filter((r) => r.productId && Number(r.returnedQty) > 0)
            .map((r) => ({
              productId: r.productId,
              returnedQty: r.returnedQty,
              unitPrice: r.unitPrice || 0,
              reason: r.reason,
              condition: r.condition,
            })),
        )}
      />

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="supplierId">
              Supplier <span className="text-destructive">*</span>
            </Label>
            <select
              id="supplierId"
              name="supplierId"
              required
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                const newBranchId = suppliers.find((s) => s.id === e.target.value)?.branchId;
                const nextWarehouses = warehouses.filter((w) => w.branchId === newBranchId);
                setWarehouseId(nextWarehouses[0]?.id ?? '');
              }}
              className={selectClass}
            >
              <option value="">— select supplier —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            {E('supplierId') && <p className="text-xs text-destructive">{E('supplierId')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="warehouseId">
              Warehouse <span className="text-destructive">*</span>
            </Label>
            <select
              id="warehouseId"
              name="warehouseId"
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={selectClass}
            >
              <option value="">— select warehouse —</option>
              {branchWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
            {E('warehouseId') && <p className="text-xs text-destructive">{E('warehouseId')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="returnDate">
              Return date <span className="text-destructive">*</span>
            </Label>
            <Input id="returnDate" name="returnDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vatAdjustment">VAT adjustment</Label>
            <Input id="vatAdjustment" name="vatAdjustment" type="number" step="0.01" min="0" defaultValue="0" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" name="reason" rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              Returned items <span className="text-destructive">*</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((rs) => [...rs, newRow()])}
            >
              <Plus className="h-3 w-3" />
              Add Item
            </Button>
          </div>
          <div className="space-y-3">
            {rows.map((r, idx) => (
              <div
                key={r.key}
                className="grid grid-cols-1 md:grid-cols-[2fr_0.9fr_1fr_1fr_1fr_auto] gap-2 items-end"
              >
                <div>
                  {idx === 0 && <Label className="text-xs">Product</Label>}
                  <select
                    value={r.productId}
                    onChange={(e) => {
                      const p = products.find((x) => x.id === e.target.value);
                      updateRow(r.key, {
                        productId: e.target.value,
                        unitPrice: p?.costPrice ?? r.unitPrice,
                      });
                    }}
                    className={selectClass}
                  >
                    <option value="">— select —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  {idx === 0 && <Label className="text-xs">Qty</Label>}
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.returnedQty}
                    onChange={(e) => updateRow(r.key, { returnedQty: e.target.value })}
                  />
                </div>
                <div>
                  {idx === 0 && <Label className="text-xs">Unit price</Label>}
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.unitPrice}
                    onChange={(e) => updateRow(r.key, { unitPrice: e.target.value })}
                  />
                </div>
                <div>
                  {idx === 0 && <Label className="text-xs">Condition</Label>}
                  <Input
                    value={r.condition}
                    onChange={(e) => updateRow(r.key, { condition: e.target.value })}
                    placeholder="Damaged, expired…"
                  />
                </div>
                <div>
                  {idx === 0 && <Label className="text-xs">Reason</Label>}
                  <Input
                    value={r.reason}
                    onChange={(e) => updateRow(r.key, { reason: e.target.value })}
                  />
                </div>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={rows.length === 1}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {E('items') && <p className="text-xs text-destructive">{E('items')}</p>}

          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total returned value</p>
              <p className="font-semibold tabular text-lg">
                {formatCurrency(totals.subtotal, currency)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? 'Creating…' : 'Create Return'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/purchase/returns">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
