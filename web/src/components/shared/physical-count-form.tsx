'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useActionState } from 'react';
import { ScanLine, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { postPhysicalCountAction, type StockFormState } from '@/server/actions/stock';
import { formatCurrency } from '@/lib/money';

export interface PhysicalCountProductOption {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  costPrice?: string;
}

export interface PhysicalCountWarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface Row {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  costPrice: number;
  system: string;
  counted: string;
}

export interface PhysicalCountFormProps {
  branchId: string;
  warehouses: PhysicalCountWarehouseOption[];
  products: PhysicalCountProductOption[];
  /** map from warehouseId → productId → current system balance */
  balanceByWarehouseProduct: Record<string, Record<string, string>>;
  cancelHref?: string;
}

export function PhysicalCountForm({
  branchId,
  warehouses,
  products,
  balanceByWarehouseProduct,
  cancelHref = '/warehouse',
}: PhysicalCountFormProps) {
  const [state, formAction, pending] = useActionState<StockFormState, FormData>(
    postPhysicalCountAction,
    undefined,
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id ?? '');
  const [manualProductId, setManualProductId] = useState(products[0]?.id ?? '');
  const [continuous, setContinuous] = useState(true);
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const balanceByProduct = useMemo(
    () => balanceByWarehouseProduct[warehouseId] ?? {},
    [balanceByWarehouseProduct, warehouseId],
  );

  // Re-sync already-scanned rows' System qty when the selected warehouse changes,
  // so counters aren't left comparing against a different warehouse's balance.
  useEffect(() => {
    setRows((prev) =>
      prev.map((r) => ({ ...r, system: balanceByProduct[r.productId] ?? '0' })),
    );
  }, [balanceByProduct]);

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  const byCode = useMemo(() => {
    const m = new Map<string, PhysicalCountProductOption>();
    for (const p of products) {
      if (p.barcode) m.set(p.barcode.toUpperCase(), p);
      m.set(p.sku.toUpperCase(), p);
    }
    return m;
  }, [products]);

  const addProduct = (p: PhysicalCountProductOption) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.productId === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        const cur = copy[idx];
        if (cur) copy[idx] = { ...cur, counted: (Number(cur.counted || 0) + 1).toString() };
        return copy;
      }
      return [
        ...prev,
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          costPrice: Number(p.costPrice || 0),
          system: balanceByProduct[p.id] ?? '0',
          counted: '1',
        },
      ];
    });
  };

  const onScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const raw = scanRef.current?.value.trim() ?? '';
    if (!raw) return;
    const found = byCode.get(raw.toUpperCase());
    if (!found) setScanError(`No product matches "${raw}"`);
    else {
      setScanError(null);
      addProduct(found);
    }
    if (scanRef.current) scanRef.current.value = '';
    if (!continuous) scanRef.current?.blur();
  };

  const updateCounted = (idx: number, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      const cur = copy[idx];
      if (cur) copy[idx] = { ...cur, counted: value };
      return copy;
    });
  };
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const withVariance = rows.map((r) => {
    const sys = Number(r.system || 0);
    const cnt = Number(r.counted || 0);
    const variance = cnt - sys;
    const varianceValue = variance * r.costPrice;
    return { ...r, variance, varianceValue };
  });

  const itemsJson = JSON.stringify(
    rows.map((r) => ({
      productId: r.productId,
      countedQuantity: r.counted,
      costPerUnit: r.costPrice.toString(),
    })),
  );

  const hasMismatch = withVariance.some((r) => r.variance !== 0);
  const totalMismatch = withVariance.filter((r) => r.variance !== 0).length;
  const totalCountedQty = rows.reduce((acc, r) => acc + Number(r.counted || 0), 0);
  const totalNetVarianceValue = withVariance.reduce((acc, r) => acc + r.varianceValue, 0);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="itemsJson" value={itemsJson} />

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="warehouseId">Warehouse</Label>
            <select
              id="warehouseId"
              name="warehouseId"
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="note">Count note</Label>
            <Textarea id="note" name="note" rows={1} placeholder="Audit session name, reason, or rack notes" />
          </div>
        </CardContent>
      </Card>

      {/* KPI metrics for counted vs system */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border">
            <div className="text-xs text-muted-foreground uppercase font-semibold">Total Counted Units</div>
            <div className="text-2xl font-bold mt-1 tabular">{totalCountedQty}</div>
            <div className="text-xs text-muted-foreground mt-1">{rows.length} product(s) in session</div>
          </Card>
          <Card className="p-4 border">
            <div className="text-xs text-muted-foreground uppercase font-semibold">Discrepancy Items</div>
            <div className="text-2xl font-bold mt-1 tabular">
              {totalMismatch}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                ({rows.length - totalMismatch} matched)
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalMismatch > 0 ? 'Requires stock adjustment' : 'Perfect match'}
            </div>
          </Card>
          <Card className="p-4 border">
            <div className="text-xs text-muted-foreground uppercase font-semibold">Net Financial Variance</div>
            <div
              className={`text-2xl font-bold mt-1 tabular ${
                totalNetVarianceValue > 0
                  ? 'text-emerald-700'
                  : totalNetVarianceValue < 0
                    ? 'text-destructive'
                    : 'text-muted-foreground'
              }`}
            >
              {totalNetVarianceValue > 0 ? `+${formatCurrency(totalNetVarianceValue)}` : formatCurrency(totalNetVarianceValue)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalNetVarianceValue > 0 ? 'Stock Surplus (Gain)' : totalNetVarianceValue < 0 ? 'Stock Shortage (Loss)' : 'No Financial Discrepancy'}
            </div>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={scanRef}
                onKeyDown={onScan}
                placeholder="Scan / type SKU or barcode and press Enter…"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
              <input
                type="checkbox"
                checked={continuous}
                onChange={(e) => setContinuous(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Continuous scan
            </label>
          </div>
          {scanError && <p className="text-xs text-destructive">{scanError}</p>}

          {/* Manual dropdown picker */}
          <div className="flex gap-2">
            <select
              value={manualProductId}
              onChange={(e) => setManualProductId(e.target.value)}
              className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const found = products.find((p) => p.id === manualProductId);
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
                  <th className="text-left font-semibold px-3 py-2">#</th>
                  <th className="text-left font-semibold px-3 py-2">SKU</th>
                  <th className="text-left font-semibold px-3 py-2">Name</th>
                  <th className="text-right font-semibold px-3 py-2">Unit Cost</th>
                  <th className="text-right font-semibold px-3 py-2">System</th>
                  <th className="text-right font-semibold px-3 py-2">Counted</th>
                  <th className="text-right font-semibold px-3 py-2">Qty Variance</th>
                  <th className="text-right font-semibold px-3 py-2">Value Variance</th>
                  <th className="text-right font-semibold px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {withVariance.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground text-sm">
                      Scan barcodes or select products above to start physical count.
                    </td>
                  </tr>
                )}
                {withVariance.map((r, i) => (
                  <tr key={r.productId} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs font-medium">{r.sku}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular text-muted-foreground">
                      {formatCurrency(r.costPrice)}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-muted-foreground font-medium">
                      {r.system} {r.unit}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        value={r.counted}
                        onChange={(e) => updateCounted(i, e.target.value)}
                        type="text"
                        inputMode="decimal"
                        className="h-8 w-24 text-right tabular ml-auto"
                      />
                    </td>
                    <td
                      className={
                        'px-3 py-2 text-right tabular font-semibold ' +
                        (r.variance > 0
                          ? 'text-emerald-700'
                          : r.variance < 0
                            ? 'text-destructive'
                            : 'text-muted-foreground')
                      }
                    >
                      {r.variance > 0 ? `+${r.variance}` : r.variance}
                    </td>
                    <td
                      className={
                        'px-3 py-2 text-right tabular font-medium ' +
                        (r.varianceValue > 0
                          ? 'text-emerald-700'
                          : r.varianceValue < 0
                            ? 'text-destructive'
                            : 'text-muted-foreground')
                      }
                    >
                      {r.varianceValue > 0 ? `+${formatCurrency(r.varianceValue)}` : formatCurrency(r.varianceValue)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRow(i)}
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {totalMismatch > 0
                ? `${totalMismatch} item(s) will automatically generate adjustment ledger rows (IN/OUT) with accurate unit costs.`
                : 'All counted items match the system stock — no adjustments needed.'}
            </p>
          )}
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || rows.length === 0 || !hasMismatch}>
          {pending ? 'Posting adjustments…' : hasMismatch ? 'Post variance adjustments' : 'Stock is balanced (No adjustments)'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
