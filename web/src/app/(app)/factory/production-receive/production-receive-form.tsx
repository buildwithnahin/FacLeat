'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
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
  isCompleted?: boolean;
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

  const [filterMode, setFilterMode] = useState<'pending' | 'all'>('pending');

  const pendingOrders = useMemo(() => orders.filter((o) => !o.isCompleted), [orders]);
  const displayOrders = useMemo(
    () => (filterMode === 'all' ? orders : pendingOrders),
    [orders, pendingOrders, filterMode],
  );

  const [orderId, setOrderId] = useState(displayOrders[0]?.id ?? '');

  const selectedOrder = useMemo(
    () => displayOrders.find((order) => order.id === orderId) ?? null,
    [displayOrders, orderId],
  );

  const stages = selectedOrder?.stages ?? [];
  const [fromStageId, setFromStageId] = useState(stages[0]?.id ?? '');
  const [toStageId, setToStageId] = useState(stages[1]?.id ?? stages[0]?.id ?? '');

  const handleOrderChange = (newOrderId: string) => {
    setOrderId(newOrderId);
    const order = displayOrders.find((o) => o.id === newOrderId);
    const s = order?.stages ?? [];
    setFromStageId(s[0]?.id ?? '');
    setToStageId(s[1]?.id ?? s[0]?.id ?? '');
  };

  useEffect(() => {
    if (!displayOrders.some((o) => o.id === orderId)) {
      const nextId = displayOrders[0]?.id ?? '';
      setOrderId(nextId);
      const nextOrder = displayOrders.find((o) => o.id === nextId);
      const s = nextOrder?.stages ?? [];
      setFromStageId(s[0]?.id ?? '');
      setToStageId(s[1]?.id ?? s[0]?.id ?? '');
    }
  }, [displayOrders, orderId]);

  const sameStage = Boolean(fromStageId && toStageId && fromStageId === toStageId);
  const insufficientStages = stages.length < 2;

  return (
    <form action={formAction} className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  title="Hide orders that already completed production receive"
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
                  title="Show all production orders"
                >
                  All ({orders.length})
                </button>
              </div>
            </div>
            {displayOrders.length === 0 ? (
              <div className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground bg-muted/20">
                ✓ All production orders have completed production receive.
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
                onChange={(e) => handleOrderChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {displayOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.label}
                    {order.isCompleted ? ' (✓ Receive Completed)' : ''}
                  </option>
                ))}
              </select>
            )}
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
