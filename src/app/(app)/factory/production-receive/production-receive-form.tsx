'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createProductionReceiveAction, type FactoryFormState } from '@/server/actions/factory';

type OrderOption = {
  id: string;
  label: string;
  productId: string;
  stages: Array<{ id: string; label: string }>;
};

type OperatorOption = { id: string; label: string };

export function ProductionReceiveForm({
  orders,
  operators,
}: {
  orders: OrderOption[];
  operators: OperatorOption[];
}) {
  const [state, formAction, pending] = useActionState<FactoryFormState, FormData>(
    createProductionReceiveAction,
    undefined,
  );
  const [orderId, setOrderId] = useState(orders[0]?.id ?? '');

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === orderId) ?? null,
    [orders, orderId],
  );

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
            <Label htmlFor="date">Receive Date *</Label>
            <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <Label htmlFor="fromStageId">From Process *</Label>
            <select
              id="fromStageId"
              name="fromStageId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {selectedOrder?.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="toStageId">To Process *</Label>
            <select
              id="toStageId"
              name="toStageId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {selectedOrder?.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <input type="hidden" name="productId" value={selectedOrder?.productId ?? ''} />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="receivedQty">Received Qty *</Label>
            <Input id="receivedQty" name="receivedQty" type="number" step="0.0001" min="0" required />
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
            <Label htmlFor="operatorId">Received By</Label>
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
        </div>

        <div>
          <Label htmlFor="remarks">Remarks</Label>
          <Textarea id="remarks" name="remarks" rows={3} />
        </div>
      </Card>

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : 'Create Production Receive'}
      </Button>
    </form>
  );
}
