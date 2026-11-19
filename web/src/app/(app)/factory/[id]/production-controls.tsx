'use client';

import { useActionState, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  consumeMaterialsAction,
  recordOutputAction,
  updateOrderStatusAction,
  addCostEntryAction,
  updateOverheadRateAction,
  type FactoryFormState,
} from '@/server/actions/factory';
import { PRODUCTION_ORDER_STATUS } from '@/server/validators/factory';

type MaterialLite = {
  id: string;
  productName: string;
  unit: string;
  plannedQty: string;
  consumedQty: string;
  fromWarehouseId: string | null;
  /** Pre-filled default cost per unit for consumption (unitCost override or product.costPrice) */
  defaultCostPerUnit: string;
};

export function ProductionControls({
  order,
  warehouses,
  suggestedCostPerUnit,
  isEstimatedCostPerUnit,
}: {
  order: {
    id: string;
    status: string;
    overheadRate: string;
    plannedQty?: string;
    producedQty?: string;
    unit?: string;
    materials: MaterialLite[];
  };
  warehouses: { id: string; code: string; name: string }[];
  /** Auto-calculated cost per unit from the cost summary (may be estimated) */
  suggestedCostPerUnit: string | null;
  isEstimatedCostPerUnit: boolean;
}) {
  const [consumeState, consumeAction, consumePending] = useActionState<FactoryFormState, FormData>(
    consumeMaterialsAction,
    undefined,
  );
  const [outputState, outputAction, outputPending] = useActionState<FactoryFormState, FormData>(
    recordOutputAction,
    undefined,
  );
  const [statusState, statusAction, statusPending] = useActionState<FactoryFormState, FormData>(
    updateOrderStatusAction,
    undefined,
  );
  const [overheadRateState, overheadRateAction, overheadRatePending] =
    useActionState<FactoryFormState, FormData>(updateOverheadRateAction, undefined);
  const [overheadState, overheadAction, overheadPending] =
    useActionState<FactoryFormState, FormData>(addCostEntryAction, undefined);
  const [wedgeState, wedgeAction, wedgePending] =
    useActionState<FactoryFormState, FormData>(addCostEntryAction, undefined);
  const [labourState, labourAction, labourPending] =
    useActionState<FactoryFormState, FormData>(addCostEntryAction, undefined);

  // Controlled cost per unit synced with live calculated suggestedCostPerUnit
  const [outputCostPerUnit, setOutputCostPerUnit] = useState<string>(
    suggestedCostPerUnit ? Number(suggestedCostPerUnit).toFixed(4) : '0',
  );

  useEffect(() => {
    if (suggestedCostPerUnit != null) {
      setOutputCostPerUnit(Number(suggestedCostPerUnit).toFixed(4));
    }
  }, [suggestedCostPerUnit]);

  // Pre-fill quantity with remaining planned quantity from the order/planning phase
  const remainingQty = Math.max(0, Number(order.plannedQty ?? 0) - Number(order.producedQty ?? 0));
  const defaultOutputQty =
    remainingQty > 0
      ? remainingQty.toString()
      : order.plannedQty && Number(order.plannedQty) > 0
        ? order.plannedQty
        : '1';
  const [outputQty, setOutputQty] = useState<string>(defaultOutputQty);

  useEffect(() => {
    const rem = Math.max(0, Number(order.plannedQty ?? 0) - Number(order.producedQty ?? 0));
    setOutputQty(
      rem > 0
        ? rem.toString()
        : order.plannedQty && Number(order.plannedQty) > 0
          ? order.plannedQty
          : '1',
    );
  }, [order.plannedQty, order.producedQty]);

  const [consumption, setConsumption] = useState<
    Record<string, { quantity: string; costPerUnit: string; warehouseId?: string }>
  >(() => {
    // Pre-fill each material's cost per unit and source warehouse
    const init: Record<string, { quantity: string; costPerUnit: string; warehouseId?: string }> = {};
    for (const m of order.materials) {
      init[m.id] = {
        quantity: '',
        costPerUnit: m.defaultCostPerUnit ?? '',
        warehouseId: m.fromWarehouseId ?? (warehouses[0]?.id ?? ''),
      };
    }
    return init;
  });

  useEffect(() => {
    if (consumeState?.success) {
      // Reset quantities but keep cost per unit defaults and warehouse selection
      setConsumption((prev) => {
        const reset: Record<string, { quantity: string; costPerUnit: string; warehouseId?: string }> = {};
        for (const m of order.materials) {
          reset[m.id] = {
            quantity: '',
            costPerUnit: prev[m.id]?.costPerUnit ?? m.defaultCostPerUnit ?? '',
            warehouseId: prev[m.id]?.warehouseId ?? m.fromWarehouseId ?? (warehouses[0]?.id ?? ''),
          };
        }
        return reset;
      });
    }
  }, [consumeState?.success]);

  const closed = order.status === 'COMPLETED' || order.status === 'CANCELLED';

  return (
    <div className="space-y-6">
      {/* Order status */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Order status</h3>
        </div>
        <form action={statusAction} className="flex items-center gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          <select
            name="status"
            defaultValue={order.status ?? 'PLANNED'}
            className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {PRODUCTION_ORDER_STATUS.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
          <Button size="sm" type="submit" variant="outline" disabled={statusPending}>
            {statusPending ? 'Saving…' : 'Update'}
          </Button>
        </form>
        {statusState?.error && <p className="text-xs text-red-600">{statusState.error}</p>}
      </Card>

      {/* Consume materials */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Consume materials</h3>
        {order.materials.length === 0 ? (
          <p className="text-xs text-muted-foreground">No materials defined for this order.</p>
        ) : (
          <form
            action={(fd) => {
              const items = Object.entries(consumption)
                .filter(([, v]) => v.quantity && Number(v.quantity) > 0)
                .map(([materialId, v]) => ({
                  materialId,
                  quantity: Number(v.quantity),
                  costPerUnit: Number(v.costPerUnit || 0),
                  warehouseId: v.warehouseId || undefined,
                }));
              fd.set('items', JSON.stringify(items));
              return consumeAction(fd);
            }}
            className="space-y-3"
          >
            <input type="hidden" name="orderId" value={order.id} />
            {order.materials.map((m) => (
              <div key={m.id} className="space-y-1.5 p-2.5 rounded-md bg-muted/30 border border-muted/50 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">{m.productName}</span>
                  <span className="text-muted-foreground text-[11px]">
                    Consumed: {m.consumedQty} / {m.plannedQty} {m.unit}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div>
                    <Label className="text-[10px]">Source warehouse</Label>
                    <select
                      value={consumption[m.id]?.warehouseId ?? m.fromWarehouseId ?? warehouses[0]?.id ?? ''}
                      onChange={(e) =>
                        setConsumption((prev) => ({
                          ...prev,
                          [m.id]: {
                            quantity: prev[m.id]?.quantity ?? '',
                            costPerUnit: prev[m.id]?.costPerUnit ?? '',
                            warehouseId: e.target.value,
                          },
                        }))
                      }
                      className="h-8 w-full rounded border border-input bg-transparent px-2 text-xs"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Qty to consume</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      className="h-8"
                      value={consumption[m.id]?.quantity ?? ''}
                      onChange={(e) =>
                        setConsumption((prev) => ({
                          ...prev,
                          [m.id]: {
                            warehouseId: prev[m.id]?.warehouseId ?? m.fromWarehouseId ?? (warehouses[0]?.id ?? ''),
                            costPerUnit: prev[m.id]?.costPerUnit ?? '',
                            quantity: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Cost / unit</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      className="h-8"
                      value={consumption[m.id]?.costPerUnit ?? ''}
                      onChange={(e) =>
                        setConsumption((prev) => ({
                          ...prev,
                          [m.id]: {
                            warehouseId: prev[m.id]?.warehouseId ?? m.fromWarehouseId ?? (warehouses[0]?.id ?? ''),
                            quantity: prev[m.id]?.quantity ?? '',
                            costPerUnit: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="submit"
              size="sm"
              variant="dark"
              className="w-full"
              disabled={consumePending || closed}
            >
              {consumePending ? 'Posting…' : 'Post consumption'}
            </Button>
            {consumeState?.error && <p className="text-xs text-red-600">{consumeState.error}</p>}
            {consumeState?.success && <p className="text-xs text-emerald-600">Consumption posted.</p>}
          </form>
        )}
      </Card>

      {/* Record output */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Record output</h3>
        {suggestedCostPerUnit && (
          <div className={`rounded-md px-3 py-2 text-xs border ${isEstimatedCostPerUnit ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {isEstimatedCostPerUnit ? '⚠️ Estimated' : '✓ Calculated'} cost per unit:{' '}
            <span className="font-bold">{Number(suggestedCostPerUnit).toFixed(4)}</span>
            {isEstimatedCostPerUnit && ' (based on planned qty — update after actual consumption)'}
          </div>
        )}
        <form action={outputAction} className="space-y-3">
          <input type="hidden" name="orderId" value={order.id} />
          <div>
            <div className="flex justify-between items-center mb-1">
              <Label className="text-xs">Quantity ({order.unit || 'PCS'})</Label>
              <span className="text-[11px] text-muted-foreground">
                Remaining: <strong className="text-foreground">{remainingQty}</strong> / {order.plannedQty ?? 0}
              </span>
            </div>
            <Input
              name="quantity"
              type="number"
              min="0.0001"
              step="0.0001"
              value={outputQty ?? ''}
              onChange={(e) => setOutputQty(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="text-xs">
              Cost per unit
              {suggestedCostPerUnit && (
                <span className="ml-1 text-muted-foreground font-normal">
                  (auto: {Number(suggestedCostPerUnit).toFixed(4)})
                </span>
              )}
            </Label>
            <Input
              name="costPerUnit"
              type="number"
              min="0"
              step="0.0001"
              value={outputCostPerUnit ?? ''}
              onChange={(e) => setOutputCostPerUnit(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Target warehouse</Label>
            <select
              name="toWarehouseId"
              required
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Note</Label>
            <Textarea name="note" rows={2} />
          </div>
          <Button type="submit" size="sm" variant="dark" className="w-full" disabled={outputPending || closed}>
            {outputPending ? 'Posting…' : 'Post finished goods'}
          </Button>
          {outputState?.error && <p className="text-xs text-red-600">{outputState.error}</p>}
          {outputState?.success && <p className="text-xs text-emerald-600">Output recorded.</p>}
        </form>
      </Card>

      {/* Overhead rate (%) */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Overhead rate (%)</h3>
        <form action={overheadRateAction} className="flex gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          <Input
            name="overheadRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={order.overheadRate ?? ''}
            placeholder="e.g. 15"
            className="flex-1"
          />
          <Button size="sm" type="submit" variant="outline" disabled={overheadRatePending || closed}>
            {overheadRatePending ? 'Saving…' : 'Set'}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">Applied as % on total material cost</p>
        {overheadRateState?.error && (
          <p className="text-xs text-red-600">{overheadRateState.error}</p>
        )}
        {overheadRateState?.success && (
          <p className="text-xs text-emerald-600">Overhead rate updated.</p>
        )}
      </Card>

      {/* Add overhead entry */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Add overhead entry</h3>
        <form action={overheadAction} className="space-y-2">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="type" value="OVERHEAD" />
          <div>
            <Label className="text-xs">Description</Label>
            <Input name="description" type="text" placeholder="e.g. Rent, Electricity" required maxLength={255} />
          </div>
          <div>
            <Label className="text-xs">Amount</Label>
            <Input name="amount" type="number" min="0" step="0.01" required />
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Input name="note" type="text" maxLength={500} />
          </div>
          <Button size="sm" type="submit" variant="outline" className="w-full" disabled={overheadPending || closed}>
            {overheadPending ? 'Adding…' : 'Add overhead'}
          </Button>
          {overheadState?.error && <p className="text-xs text-red-600">{overheadState.error}</p>}
          {overheadState?.success && <p className="text-xs text-emerald-600">Overhead entry added.</p>}
        </form>
      </Card>

      {/* Add wedge / sundry entry */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Add wedge / sundry entry</h3>
        <form action={wedgeAction} className="space-y-2">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="type" value="WEDGE" />
          <div>
            <Label className="text-xs">Description</Label>
            <Input name="description" type="text" placeholder="e.g. Transport, Packaging" required maxLength={255} />
          </div>
          <div>
            <Label className="text-xs">Amount</Label>
            <Input name="amount" type="number" min="0" step="0.01" required />
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Input name="note" type="text" maxLength={500} />
          </div>
          <Button size="sm" type="submit" variant="outline" className="w-full" disabled={wedgePending || closed}>
            {wedgePending ? 'Adding…' : 'Add wedge'}
          </Button>
          {wedgeState?.error && <p className="text-xs text-red-600">{wedgeState.error}</p>}
          {wedgeState?.success && <p className="text-xs text-emerald-600">Wedge entry added.</p>}
        </form>
      </Card>

      {/* Add labour entry */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Add labour entry</h3>
        <form action={labourAction} className="space-y-2">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="type" value="LABOUR" />
          <div>
            <Label className="text-xs">Task / worker</Label>
            <Input name="description" type="text" placeholder="e.g. Cutting — John" required maxLength={255} />
          </div>
          <div>
            <Label className="text-xs">Amount</Label>
            <Input name="amount" type="number" min="0" step="0.01" placeholder="e.g. 500" required />
          </div>
          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Input name="note" type="text" maxLength={500} />
          </div>
          <Button size="sm" type="submit" variant="outline" className="w-full" disabled={labourPending || closed}>
            {labourPending ? 'Adding…' : 'Add labour'}
          </Button>
          {labourState?.error && <p className="text-xs text-red-600">{labourState.error}</p>}
          {labourState?.success && <p className="text-xs text-emerald-600">Labour entry added.</p>}
        </form>
      </Card>
    </div>
  );
}
