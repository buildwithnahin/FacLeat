'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, ScanLine, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import type { StockFormState } from '@/server/actions/stock';

export type MovementMode = 'receive' | 'issue' | 'transfer';

export interface ProductOption {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  type: string;
  costPrice: string;
  sellPrice: string;
}

export interface WarehouseOption {
  id: string;
  name: string;
  code: string;
  branchName?: string;
  branchCode?: string;
}

interface Row {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  type: string;
  quantity: string;
  costPerUnit: string;
}

const TYPE_LABEL: Record<string, string> = {
  RAW_MATERIAL: 'Raw Material',
  WORK_IN_PROGRESS: 'WIP',
  FINISHED_GOOD: 'Finished Good',
  CONSUMABLE: 'Consumable',
  SERVICE: 'Service',
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  RAW_MATERIAL: 'bg-amber-100 text-amber-800',
  WORK_IN_PROGRESS: 'bg-blue-100 text-blue-800',
  FINISHED_GOOD: 'bg-emerald-100 text-emerald-800',
  CONSUMABLE: 'bg-slate-100 text-slate-700',
  SERVICE: 'bg-slate-100 text-slate-700',
};

export interface StockMovementFormProps {
  mode: MovementMode;
  branchId: string;
  warehouses: WarehouseOption[];
  products: ProductOption[];
  action: (prev: StockFormState, formData: FormData) => Promise<StockFormState>;
  submitLabel: string;
  showCost: boolean;
  continuousScanDefault?: boolean;
  cancelHref?: string;
}

export function StockMovementForm({
  mode,
  branchId,
  warehouses,
  products,
  action,
  submitLabel,
  showCost,
  continuousScanDefault = true,
  cancelHref = '/inventory/stock',
}: StockMovementFormProps) {
  const [state, formAction, pending] = useActionState<StockFormState, FormData>(action, undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [continuous, setContinuous] = useState(continuousScanDefault);
  const scanRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1]?.id ?? warehouses[0]?.id ?? '');

  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
      return matchName || matchSku || matchBarcode;
    });
  }, [products, searchQuery]);

  const addProduct = (p: ProductOption, quantity = '1') => {
    setRows((prev) => {
      const existing = prev.findIndex((r) => r.productId === p.id);
      if (existing >= 0) {
        const copy = [...prev];
        const cur = copy[existing];
        if (cur) {
          const newQty = (Number(cur.quantity) + Number(quantity)).toString();
          copy[existing] = { ...cur, quantity: newQty };
        }
        return copy;
      }
      return [
        ...prev,
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          type: p.type,
          quantity,
          costPerUnit: showCost ? p.costPrice : '0',
        },
      ];
    });
  };

  const onScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = searchQuery.trim().toLowerCase();
      if (!raw) return;

      // 1. Exact match by barcode or SKU
      let found = products.find(
        (p) => (p.barcode && p.barcode.toLowerCase() === raw) || p.sku.toLowerCase() === raw,
      );

      // 2. Exact match by name
      if (!found) {
        found = products.find((p) => p.name.toLowerCase() === raw);
      }

      // 3. Match from filtered list
      if (!found && filteredProducts.length > 0) {
        found = filteredProducts[0];
      }

      if (found) {
        setScanError(null);
        addProduct(found);
        setSearchQuery('');
        setDropdownOpen(false);
      } else {
        setScanError(`No product matches "${searchQuery}"`);
      }

      if (!continuous) scanRef.current?.blur();
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  const updateQty = (idx: number, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      const cur = copy[idx];
      if (cur) copy[idx] = { ...cur, quantity: value };
      return copy;
    });
  };
  const updateCost = (idx: number, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      const cur = copy[idx];
      if (cur) copy[idx] = { ...cur, costPerUnit: value };
      return copy;
    });
  };
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const totalQty = rows.reduce((a, r) => a + Number(r.quantity || 0), 0);

  const itemsJson = JSON.stringify(
    rows.map((r) => ({
      productId: r.productId,
      quantity: r.quantity,
      costPerUnit: r.costPerUnit || '0',
    })),
  );

  const warehouseLabel = (warehouse: WarehouseOption) =>
    warehouse.branchCode || warehouse.branchName
      ? `${warehouse.name} (${warehouse.code}) - ${warehouse.branchName ?? ''}${warehouse.branchCode ? ` [${warehouse.branchCode}]` : ''}`
      : `${warehouse.name} (${warehouse.code})`;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="itemsJson" value={itemsJson} />

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {mode === 'transfer' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="fromWarehouseId">From warehouse</Label>
                <select
                  id="fromWarehouseId"
                  name="fromWarehouseId"
                  required
                  value={fromWarehouseId}
                  onChange={(e) => setFromWarehouseId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {warehouseLabel(w)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="toWarehouseId">To warehouse</Label>
                <select
                  id="toWarehouseId"
                  name="toWarehouseId"
                  required
                  value={toWarehouseId}
                  onChange={(e) => setToWarehouseId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {warehouseLabel(w)}
                    </option>
                  ))}
                </select>
                {fromWarehouseId && toWarehouseId && fromWarehouseId === toWarehouseId && (
                  <p className="text-xs text-destructive">
                    Source and destination warehouses must be different.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Input id="note" name="note" placeholder="Optional" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="warehouseId">Warehouse</Label>
                <select
                  id="warehouseId"
                  name="warehouseId"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {warehouseLabel(w)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refType">Reason</Label>
                <select
                  id="refType"
                  name="refType"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {mode === 'receive' ? (
                    <>
                      <option value="OPENING">Opening balance</option>
                      <option value="MANUAL_ADJUST">Manual adjustment</option>
                    </>
                  ) : (
                    <>
                      <option value="CONSUMPTION">Consumption</option>
                      <option value="MANUAL_ADJUST">Manual adjustment</option>
                    </>
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  {mode === 'receive'
                    ? 'Goods receiving and customer returns go through Purchase → GRN / POS / Wholesale / Warehouse Returns instead.'
                    : 'Sales and damage write-offs go through POS / Wholesale / Corporate Sales / Warehouse Damage Report instead.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refId">Reference #</Label>
                <Input id="refId" name="refId" placeholder="Optional (e.g. INV-0042)" />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label htmlFor="note">Note</Label>
                <Textarea id="note" name="note" rows={1} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div ref={dropdownRef} className="relative space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={scanRef}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDropdownOpen(true);
                    setScanError(null);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  onKeyDown={onScan}
                  placeholder="Scan barcode, type SKU, or search product name…"
                  className="pl-9 pr-8"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  title="Toggle product list"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1 text-xs"
                onClick={() => setDropdownOpen((prev) => !prev)}
              >
                <Search className="h-3.5 w-3.5" />
                {dropdownOpen ? 'Hide list' : 'Browse products'}
              </Button>
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

            {/* Dropdown list of matching products */}
            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-72 overflow-y-auto divide-y">
                <div className="p-2 text-xs font-semibold text-muted-foreground bg-muted/40 sticky top-0 flex justify-between items-center">
                  <span>{filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'} available</span>
                  <span className="text-[11px] font-normal">Click to add or press Enter</span>
                </div>
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No products match &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        addProduct(p);
                        setSearchQuery('');
                        setDropdownOpen(false);
                        setScanError(null);
                        if (continuous) scanRef.current?.focus();
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/70 transition flex items-center justify-between gap-3 text-sm group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium group-hover:text-blue-600 truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground flex gap-2 items-center mt-0.5">
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">{p.sku}</span>
                          {p.barcode && <span>Barcode: {p.barcode}</span>}
                          <span>Unit: {p.unit}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            TYPE_BADGE_CLASS[p.type] ?? 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {TYPE_LABEL[p.type] ?? p.type}
                        </span>
                        {showCost && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Cost: ৳{Number(p.costPrice).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {scanError && <p className="text-xs text-destructive">{scanError}</p>}

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">#</th>
                  <th className="text-left font-semibold px-3 py-2">SKU</th>
                  <th className="text-left font-semibold px-3 py-2">Name</th>
                  <th className="text-left font-semibold px-3 py-2">Type</th>
                  <th className="text-right font-semibold px-3 py-2">Quantity</th>
                  <th className="text-left font-semibold px-3 py-2">Unit</th>
                  {showCost && <th className="text-right font-semibold px-3 py-2">Cost / unit</th>}
                  <th className="text-right font-semibold px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={showCost ? 8 : 7}
                      className="px-3 py-10 text-center text-muted-foreground text-sm"
                    >
                      Scan or type a barcode / SKU to add items.
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={r.productId}>
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASS[r.type] ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        value={r.quantity}
                        onChange={(e) => updateQty(i, e.target.value)}
                        type="text"
                        inputMode="decimal"
                        className="h-8 w-28 text-right tabular ml-auto"
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.unit}</td>
                    {showCost && (
                      <td className="px-3 py-2 text-right">
                        <Input
                          value={r.costPerUnit}
                          onChange={(e) => updateCost(i, e.target.value)}
                          type="text"
                          inputMode="decimal"
                          className="h-8 w-28 text-right tabular ml-auto"
                        />
                      </td>
                    )}
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
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30">
                    <td colSpan={4} className="px-3 py-2 font-medium">
                      Total items: {rows.length}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular">{totalQty}</td>
                    <td colSpan={showCost ? 3 : 2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={
            pending ||
            rows.length === 0 ||
            rows.some((r) => !r.quantity || Number(r.quantity) <= 0) ||
            (mode === 'transfer' && (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId))
          }
        >
          {pending ? 'Posting…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
