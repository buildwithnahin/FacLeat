'use client';

import { useActionState, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createFinishedGoodsReceiveAction, type FactoryFormState } from '@/server/actions/factory';
import { QUALITY_CHECK_STATUS, UNITS } from '@/server/validators/factory';

type OrderOption = {
  id: string;
  label: string;
  productId: string;
  unit: (typeof UNITS)[number];
  stages: Array<{ id: string; label: string }>;
};

type WarehouseOption = { id: string; label: string };

type ItemRow = {
  productId: string;
  batchNo: string;
  quantity: string;
  uom: (typeof UNITS)[number];
  qualityStatus: (typeof QUALITY_CHECK_STATUS)[number];
};

export function FinishedGoodsReceiveForm({
  orders,
  warehouses,
}: {
  orders: OrderOption[];
  warehouses: WarehouseOption[];
}) {
  const [state, formAction, pending] = useActionState<FactoryFormState, FormData>(
    createFinishedGoodsReceiveAction,
    undefined,
  );
  const [orderId, setOrderId] = useState(orders[0]?.id ?? '');
  const [items, setItems] = useState<ItemRow[]>([]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === orderId) ?? null,
    [orders, orderId],
  );

  const addFinishedItem = () => {
    if (!selectedOrder) return;
    setItems((prev) => [
      ...prev,
      {
        productId: selectedOrder.productId,
        batchNo: '',
        quantity: '1',
        uom: selectedOrder.unit,
        qualityStatus: 'PENDING',
      },
    ]);
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="orderId">Production Order *</Label>
            <select
              id="orderId"
              name="orderId"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="date">Receive Date *</Label>
            <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <Label htmlFor="warehouseId">FG Warehouse *</Label>
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
          <div>
            <Label htmlFor="sourceStageId">Source Stage</Label>
            <select
              id="sourceStageId"
              name="sourceStageId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Final process / packing</option>
              {selectedOrder?.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="remarks">Remarks</Label>
          <Textarea id="remarks" name="remarks" rows={3} />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Finished Goods Items</h2>
            <p className="text-sm text-muted-foreground">Receive packed finished goods into FG warehouse.</p>
          </div>
          <Button type="button" variant="outline" onClick={addFinishedItem}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No FG items yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-[2fr_150px_140px_120px_150px_auto] gap-2 items-end"
              >
                <Input value={selectedOrder?.label ?? ''} readOnly />
                <Input
                  placeholder="Batch"
                  value={item.batchNo}
                  onChange={(e) =>
                    setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, batchNo: e.target.value } : row))
                  }
                />
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={item.quantity}
                  onChange={(e) =>
                    setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: e.target.value } : row))
                  }
                />
                <select
                  value={item.uom}
                  onChange={(e) =>
                    setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, uom: e.target.value as (typeof UNITS)[number] } : row))
                  }
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
                <select
                  value={item.qualityStatus}
                  onChange={(e) =>
                    setItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, qualityStatus: e.target.value as (typeof QUALITY_CHECK_STATUS)[number] } : row))
                  }
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {QUALITY_CHECK_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Create FG Receive'}
      </Button>
    </form>
  );
}
