'use client';

import { useActionState, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, ScanLine, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WorkflowFormState } from '@/server/actions/warehouse-workflows';
import { cn } from '@/lib/utils';

type ProductOption = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type SourceDocumentOption = {
  value: string;
  label: string;
};

type Row = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: string;
};

export function ReturnIntakeForm({
  branchId,
  warehouses,
  products,
  sourceDocuments,
  action,
}: {
  branchId: string;
  warehouses: WarehouseOption[];
  products: ProductOption[];
  sourceDocuments: Record<string, SourceDocumentOption[]>;
  action: (prev: WorkflowFormState, formData: FormData) => Promise<WorkflowFormState>;
}) {
  const [state, formAction, pending] = useActionState<WorkflowFormState, FormData>(action, undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualProductId, setManualProductId] = useState(products[0]?.id ?? '');
  const [sourceDocumentType, setSourceDocumentType] = useState('POS');
  const [sourceDocumentNumber, setSourceDocumentNumber] = useState('');
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
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

  const addManual = () => {
    const found = products.find((product) => product.id === manualProductId);
    if (!found) return;
    addProduct(found);
  };

  const itemsJson = JSON.stringify(
    rows.map((row) => ({ productId: row.productId, quantity: row.quantity })),
  );

  const documentOptions = sourceDocuments[sourceDocumentType] ?? [];
  const supportsDocumentDropdown = sourceDocumentType !== 'OTHER';

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="itemsJson" value={itemsJson} />

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="warehouseId">Sellable destination warehouse</Label>
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
            <Label htmlFor="sourceDocumentType">Source document type</Label>
            <select
              id="sourceDocumentType"
              name="sourceDocumentType"
              value={sourceDocumentType}
              onChange={(event) => {
                setSourceDocumentType(event.target.value);
                setSourceDocumentNumber('');
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="POS">POS sale</option>
              <option value="WHOLESALE">Wholesale invoice</option>
              <option value="CORPORATE">Corporate invoice</option>
              <option value="ECOMMERCE">E-commerce order</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sourceDocumentNumber">Invoice / order number</Label>
            {supportsDocumentDropdown ? (
              <>
                <input type="hidden" name="sourceDocumentNumber" value={sourceDocumentNumber} />
                <button
                  id="sourceDocumentNumber"
                  type="button"
                  onClick={() => setDocumentPickerOpen(true)}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                >
                  <span className={cn(!sourceDocumentNumber && 'text-muted-foreground')}>
                    {sourceDocumentNumber
                      ? documentOptions.find((option) => option.value === sourceDocumentNumber)?.label ?? sourceDocumentNumber
                      : documentOptions.length > 0
                        ? 'Search and select a document number'
                        : 'No documents found for this type'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </button>
                {documentPickerOpen && (
                  <div className="fixed inset-0 z-50">
                    <button
                      type="button"
                      aria-hidden
                      className="absolute inset-0 bg-black/30"
                      onClick={() => setDocumentPickerOpen(false)}
                    />
                    <Command className="relative mx-auto mt-24 w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-md border bg-background shadow-xl">
                      <div className="flex items-center border-b px-3">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Command.Input
                          autoFocus
                          placeholder="Search invoice / order number"
                          className="h-11 flex-1 bg-transparent px-3 text-sm outline-none"
                        />
                      </div>
                      <Command.List className="max-h-80 overflow-y-auto p-2">
                        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
                          No matching documents
                        </Command.Empty>
                        {documentOptions.map((option) => (
                          <Command.Item
                            key={option.value}
                            value={`${option.value} ${option.label}`}
                            onSelect={() => {
                              setSourceDocumentNumber(option.value);
                              setDocumentPickerOpen(false);
                            }}
                            className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                          >
                            <div className="min-w-0">
                              <div className="font-medium">{option.value}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {option.label}
                              </div>
                            </div>
                            {sourceDocumentNumber === option.value && (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            )}
                          </Command.Item>
                        ))}
                      </Command.List>
                    </Command>
                  </div>
                )}
              </>
            ) : (
              <Input
                id="sourceDocumentNumber"
                name="sourceDocumentNumber"
                placeholder="Type reference number manually"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer name</Label>
            <Input id="customerName" name="customerName" placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Customer phone</Label>
            <Input id="customerPhone" name="customerPhone" placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="financeAction">Finance action</Label>
            <select
              id="financeAction"
              name="financeAction"
              defaultValue="NONE"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="NONE">None yet</option>
              <option value="REFUND">Refund</option>
              <option value="EXCHANGE">Exchange</option>
              <option value="CREDIT_ADJUSTMENT">Credit adjustment</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="financeNote">Finance note</Label>
            <Textarea id="financeNote" name="financeNote" rows={2} placeholder="Optional finance/refund note" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="intakeNote">Intake note</Label>
            <Textarea id="intakeNote" name="intakeNote" rows={2} placeholder="Condition on arrival, packaging note, etc." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input ref={scanRef} onKeyDown={onScan} className="pl-9" placeholder="Scan barcode or type SKU and press Enter" />
            </div>
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
                  {product.name} ({product.sku})
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={addManual}>
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
                  <th className="px-3 py-2 text-left font-semibold">Unit</th>
                  <th className="px-3 py-2 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                      Add returned items to start the inspection case.
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => (
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
                    <td className="px-3 py-2 text-muted-foreground">{row.unit}</td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" size="icon-sm" variant="ghost" onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || rows.length === 0}>
          {pending ? 'Saving…' : 'Create return inspection case'}
        </Button>
      </div>
    </form>
  );
}
