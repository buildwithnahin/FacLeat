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

  const stages = selectedOrder?.stages ?? [];
  const [fromStageId, setFromStageId] = useState(stages[0]?.id ?? '');
  const [toStageId, setToStageId] = useState(stages[1]?.id ?? stages[0]?.id ?? '');

  const handleOrderChange = (newOrderId: string) => {
    setOrderId(newOrderId);
    const order = orders.find((o) => o.id === newOrderId);
    const s = order?.stages ?? [];
    setFromStageId(s[0]?.id ?? '');
    setToStageId(s[1]?.id ?? s[0]?.id ?? '');
  };

  const sameStage = Boolean(fromStageId && toStageId && fromStageId === toStageId);
  const insufficientStages = stages.length < 2;

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
              onChange={(e) => handleOrderChange(e.target.value)}
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
              value={fromStageId}
              onChange={(e) => setFromStageId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {stages.map((stage) => (
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
              value={toStageId}
              onChange={(e) => setToStageId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {insufficientStages && (
          <p className="text-sm text-amber-600">
            This production order needs at least 2 stages defined to transfer work between stages.
          </p>
        )}

        {sameStage && !insufficientStages && (
          <p className="text-sm text-amber-600">
            From process and To process cannot be the same. Please select a different receiving stage.
          </p>
        )}

        <input type="hidden" name="productId" value={selectedOrder?.productId ?? ''} />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="receivedQty">Received Qty *</Label>
            <Input id="receivedQty" name="receivedQty" type="number" step="0.0001" min="0.0001" required />
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
          <Textarea id="remarks" name="remarks" rows={3} placeholder="Notes or observations…" />
        </div>
      </Card>

      {state?.error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state?.success ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          Production receive created successfully.
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={pending || !orderId || insufficientStages || sameStage}
      >
        {pending ? 'Saving...' : 'Create Production Receive'}
      </Button>
    </form>
  );
}
