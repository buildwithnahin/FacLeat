'use client';

import { useActionState, useMemo, useRef, useState } from 'react';
import { ScanLine, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WorkflowFormState } from '@/server/actions/warehouse-workflows';
import { formatCurrency } from '@/lib/money';

type ProductOption = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  costPrice: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type Row = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: string;
  costPerUnit: string;
};

export function DamageReportForm({
  branchId,
  warehouses,
  products,
  action,
}: {
  branchId: string;
  warehouses: WarehouseOption[];
  products: ProductOption[];
  action: (prev: WorkflowFormState, formData: FormData) => Promise<WorkflowFormState>;
}) {
  const [state, formAction, pending] = useActionState<WorkflowFormState, FormData>(action, undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [manualProductId, setManualProductId] = useState(products[0]?.id ?? '');
  const [scanError, setScanError] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const byScan = useMemo(() => {
    const map = new Map<string, ProductOption>();
    for (const product of products) {
      map.set(product.sku.toUpperCase(), product);
      if (product.barcode) map.set(product.barcode.toUpperCase(), product);
    }
    return map;
  }, [products]);

  const addProduct = (product: ProductOption) => {
    setRows((prev) => {
      const index = prev.findIndex((row) => row.productId === product.id);
      if (index >= 0) {
        const next = [...prev];
        const current = next[index];
        if (current) next[index] = { ...current, quantity: String(Number(current.quantity) + 1) };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          quantity: '1',
          costPerUnit: product.costPrice,
        },
      ];
    });
  };

  const onScan = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const raw = scanRef.current?.value.trim() ?? '';
    if (!raw) return;
    const found = byScan.get(raw.toUpperCase());
    if (!found) {
      setScanError(`No product matches "${raw}"`);
    } else {
      setScanError(null);
      addProduct(found);
    }
    if (scanRef.current) scanRef.current.value = '';
  };

  const itemsJson = JSON.stringify(
    rows.map((row) => ({
      productId: row.productId,
      quantity: row.quantity,
      costPerUnit: row.costPerUnit,
    })),
  );

  const totalDamagedQty = rows.reduce((acc, r) => acc + Number(r.quantity || 0), 0);
  const totalEstimatedLoss = rows.reduce(
    (acc, r) => acc + Number(r.quantity || 0) * Number(r.costPerUnit || 0),
    0,
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="itemsJson" value={itemsJson} />

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="warehouseId">Source warehouse</Label>
            <select
              id="warehouseId"
              name="warehouseId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Input id="reason" name="reason" required placeholder="e.g. torn upper, water damage, mould" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="note">Report note</Label>
            <Textarea id="note" name="note" rows={2} placeholder="Context, batch, shift, rack, or incident details" />
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border">
            <div className="text-xs text-muted-foreground uppercase font-semibold">Total Faulty Units</div>
            <div className="text-2xl font-bold mt-1 tabular">{totalDamagedQty}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Items will be moved to Quarantine pending final action
            </div>
          </Card>
          <Card className="p-4 border">
            <div className="text-xs text-muted-foreground uppercase font-semibold">Estimated Loss Value</div>
            <div className="text-2xl font-bold mt-1 tabular text-destructive">
              {formatCurrency(totalEstimatedLoss)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Estimated inventory cost write-down / claim
            </div>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={scanRef} onKeyDown={onScan} className="pl-9" placeholder="Scan barcode or type SKU and press Enter" />
          </div>
          {scanError && <p className="text-xs text-destructive">{scanError}</p>}

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <select
              value={manualProductId}
              onChange={(event) => setManualProductId(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku}) - {formatCurrency(product.costPrice)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const found = products.find((product) => product.id === manualProductId);
                if (found) addProduct(found);
              }}
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">SKU</th>
                  <th className="px-3 py-2 text-left font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Cost / unit</th>
                  <th className="px-3 py-2 text-right font-semibold">Est. Subtotal</th>
                  <th className="px-3 py-2 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      Add damaged items to create the report.
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => {
                  const lineTotal = Number(row.quantity || 0) * Number(row.costPerUnit || 0);
                  return (
                    <tr key={row.productId}>
                      <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          value={row.quantity}
                          onChange={(event) =>
                            setRows((prev) => {
                              const next = [...prev];
                              const current = next[index];
                              if (current) next[index] = { ...current, quantity: event.target.value };
                              return next;
                            })
                          }
                          className="ml-auto h-8 w-24 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          value={row.costPerUnit}
                          onChange={(event) =>
                            setRows((prev) => {
                              const next = [...prev];
                              const current = next[index];
                              if (current) next[index] = { ...current, costPerUnit: event.target.value };
                              return next;
                            })
                          }
                          className="ml-auto h-8 w-28 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular font-medium text-destructive">
                        {formatCurrency(lineTotal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || rows.length === 0}>
          {pending ? 'Saving…' : 'Create damage report'}
        </Button>
      </div>
    </form>
  );
}
