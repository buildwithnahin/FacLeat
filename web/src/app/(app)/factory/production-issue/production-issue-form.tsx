'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createProductionIssueAction, type FactoryFormState } from '@/server/actions/factory';
import { UNITS } from '@/server/validators/factory';

type OrderOption = {
  id: string;
  number: string;
  productLabel: string;
  department: string;
  isIssueCompleted?: boolean;
  materials: Array<{
    productId: string;
    label: string;
    plannedQty: string;
    consumedQty: string;
    unit: (typeof UNITS)[number];
  }>;
};

type WarehouseOption = { id: string; label: string };

type ItemRow = {
  productId: string;
  batchNo: string;
  lotNo: string;
  requiredQty: string;
  issuedQty: string;
  uom: (typeof UNITS)[number];
};

export function ProductionIssueForm({
  orders,
  warehouses,
}: {
  orders: OrderOption[];
  warehouses: WarehouseOption[];
}) {
  const [state, formAction, pending] = useActionState<FactoryFormState, FormData>(
    createProductionIssueAction,
    undefined,
  );

  const [filterMode, setFilterMode] = useState<'pending' | 'all'>('pending');

  const pendingOrders = useMemo(() => orders.filter((o) => !o.isIssueCompleted), [orders]);
  const displayOrders = useMemo(
    () => (filterMode === 'all' ? orders : pendingOrders),
    [orders, pendingOrders, filterMode],
  );

  const [orderId, setOrderId] = useState(displayOrders[0]?.id ?? '');
  const [items, setItems] = useState<ItemRow[]>([]);

  useEffect(() => {
    if (!displayOrders.some((o) => o.id === orderId)) {
      setOrderId(displayOrders[0]?.id ?? '');
      setItems([]);
    }
  }, [displayOrders, orderId]);

  const selectedOrder = useMemo(
    () => displayOrders.find((order) => order.id === orderId) ?? null,
    [displayOrders, orderId],
  );

  const uniqueMaterials = useMemo(() => {
    if (!selectedOrder) return [];
    const seen = new Set<string>();
    return selectedOrder.materials.filter((m) => {
      if (seen.has(m.productId)) return false;
      seen.add(m.productId);
      return true;
    });
  }, [selectedOrder]);

  const syncFromOrder = () => {
    if (!selectedOrder || selectedOrder.materials.length === 0) return;
    setItems(
      selectedOrder.materials.map((material) => ({
        productId: material.productId,
        batchNo: '',
        lotNo: '',
        requiredQty: material.plannedQty,
        issuedQty: material.plannedQty,
        uom: material.unit,
      })),
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items.map((it) => ({
            ...it,
            requiredQty: Number(it.requiredQty) || 0,
            issuedQty: Number(it.issuedQty) || 0,
          })),
        )}
      />

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="orderId">Production Order *</Label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFilterMode('pending')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    filterMode === 'pending'
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                  title="Hide orders that already completed the issue phase"
                >
                  Pending ({pendingOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    filterMode === 'all'
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                  title="Show all production orders including completed issues"
                >
                  All ({orders.length})
                </button>
              </div>
            </div>
            {displayOrders.length === 0 ? (
              <div className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground bg-muted/20">
                ✓ All production orders have completed the issue phase.
                {orders.length > 0 && filterMode === 'pending' && (
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className="ml-1 text-primary underline hover:opacity-80"
                  >
                    Show all ({orders.length})
                  </button>
                )}
              </div>
            ) : (
              <select
                id="orderId"
                name="orderId"
                value={orderId}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  setItems([]);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {displayOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.number} — {order.productLabel}
                    {order.isIssueCompleted ? ' (✓ Issue Completed)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <Label htmlFor="date">Issue Date *</Label>
            <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <Label htmlFor="warehouseId">RM Warehouse *</Label>
            <select
              id="warehouseId"
              name="warehouseId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedOrder ? (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <div className="font-medium">{selectedOrder.number}</div>
            <div className="text-muted-foreground">{selectedOrder.productLabel}</div>
            <div className="text-xs text-muted-foreground mt-1">Production Department: {selectedOrder.department}</div>
          </div>
        ) : null}

        <div>
          <Label htmlFor="remarks">Remarks</Label>
          <Textarea id="remarks" name="remarks" rows={3} placeholder="Notes or instructions…" />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Issue Items</h2>
            <p className="text-sm text-muted-foreground">Issue raw materials from RM warehouse into WIP</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={syncFromOrder}
              disabled={!selectedOrder || selectedOrder.materials.length === 0}
            >
              Sync from BOM
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!selectedOrder || selectedOrder.materials.length === 0}
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  {
                    productId: selectedOrder?.materials[0]?.productId ?? '',
                    batchNo: '',
                    lotNo: '',
                    requiredQty: '1',
                    issuedQty: '1',
                    uom: selectedOrder?.materials[0]?.unit ?? 'PCS',
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>
        </div>

        {selectedOrder && selectedOrder.materials.length === 0 && (
          <p className="text-sm text-amber-600">
            This production order has no BOM materials configured.
          </p>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No issue items yet. Use &ldquo;Sync from BOM&rdquo; to load material lines.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-[2fr_120px_120px_120px_120px_110px_auto] gap-2 items-end"
              >
                <div>
                  <Label className="text-xs text-muted-foreground">Product</Label>
                  <select
                    value={item.productId}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, productId: e.target.value } : row))
                    }
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {uniqueMaterials.map((material) => (
                      <option key={material.productId} value={material.productId}>
                        {material.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Batch</Label>
                  <Input
                    placeholder="Batch"
                    value={item.batchNo}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, batchNo: e.target.value } : row))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Lot</Label>
                  <Input
                    placeholder="Lot"
                    value={item.lotNo}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, lotNo: e.target.value } : row))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Required</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="Required"
                    value={item.requiredQty}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, requiredQty: e.target.value } : row))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Issued *</Label>
                  <Input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    placeholder="Issued"
                    value={item.issuedQty}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, issuedQty: e.target.value } : row))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">UoM</Label>
                  <select
                    value={item.uom}
                    onChange={(e) =>
                      setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, uom: e.target.value as (typeof UNITS)[number] } : row))
                    }
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                  className="mb-0.5"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {state?.error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state?.success ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          Issue voucher created successfully.
        </div>
      ) : null}

      <Button type="submit" disabled={pending || items.length === 0 || !orderId}>
        {pending ? 'Saving...' : 'Create Issue Voucher'}
      </Button>
    </form>
  );
}
