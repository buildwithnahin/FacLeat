'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveProcessTrackingAction, type FactoryFormState } from '@/server/actions/factory';
import { PROCESS_TRACKING_STATUS } from '@/server/validators/factory';

type OrderOption = {
  id: string;
  label: string;
  productId: string;
  stages: Array<{ id: string; label: string }>;
};

type OperatorOption = { id: string; label: string };

export function ProcessTrackingForm({
  orders,
  operators,
}: {
  orders: OrderOption[];
  operators: OperatorOption[];
}) {
  const [state, formAction, pending] = useActionState<FactoryFormState, FormData>(
    saveProcessTrackingAction,
    undefined,
  );
  const [orderId, setOrderId] = useState(orders[0]?.id ?? '');

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === orderId) ?? null,
    [orders, orderId],
  );

  const hasStages = Boolean(selectedOrder?.stages && selectedOrder.stages.length > 0);

  return (
    <form action={formAction} className="space-y-6">
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
            <Label htmlFor="stageId">Process Name *</Label>
            <select
              id="stageId"
              name="stageId"
              disabled={!hasStages}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm disabled:opacity-50"
            >
              {selectedOrder?.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="operatorId">Operator</Label>
            <select
              id="operatorId"
              name="operatorId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Select operator</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="status">Status *</Label>
            <select
              id="status"
              name="status"
              defaultValue="RUNNING"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {PROCESS_TRACKING_STATUS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!hasStages && selectedOrder && (
          <p className="text-sm text-amber-600">
            This production order has no stages defined. Add stages to the order to record tracking.
          </p>
        )}

        <input type="hidden" name="productId" value={selectedOrder?.productId ?? ''} />
        <input type="hidden" name="trackingId" value="" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="machine">Machine</Label>
            <Input id="machine" name="machine" placeholder="Machine identifier" />
          </div>
          <div>
            <Label htmlFor="batchNo">Batch No</Label>
            <Input id="batchNo" name="batchNo" placeholder="Batch identifier" />
          </div>
          <div>
            <Label htmlFor="startTime">Start Time</Label>
            <Input id="startTime" name="startTime" type="datetime-local" />
          </div>
          <div>
            <Label htmlFor="endTime">End Time</Label>
            <Input id="endTime" name="endTime" type="datetime-local" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="inputQty">Input Qty *</Label>
            <Input id="inputQty" name="inputQty" type="number" step="0.0001" min="0" required />
          </div>
          <div>
            <Label htmlFor="outputQty">Output Qty</Label>
            <Input id="outputQty" name="outputQty" type="number" step="0.0001" min="0" defaultValue="0" />
          </div>
          <div>
            <Label htmlFor="rejectedQty">Rejected Qty</Label>
            <Input id="rejectedQty" name="rejectedQty" type="number" step="0.0001" min="0" defaultValue="0" />
          </div>
          <div>
            <Label htmlFor="scrapQty">Scrap Qty</Label>
            <Input id="scrapQty" name="scrapQty" type="number" step="0.0001" min="0" defaultValue="0" />
          </div>
          <div>
            <Label htmlFor="reworkQty">Rework Qty</Label>
            <Input id="reworkQty" name="reworkQty" type="number" step="0.0001" min="0" defaultValue="0" />
          </div>
        </div>
      </Card>

      {state?.error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state?.success ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          Process tracking saved successfully.
        </div>
      ) : null}

      <Button type="submit" disabled={pending || !hasStages || !orderId}>
        {pending ? 'Saving...' : 'Save Process Tracking'}
      </Button>
    </form>
  );
}
