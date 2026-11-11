'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CurrencyCode } from '@/lib/money';
import { packEcommerceOrderAction, fulfillEcommerceOrderAction } from '@/server/actions/ecommerce';
import { ReturnForm } from './return-form';

interface OrderItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  fulfilledQty: number;
  returnedQty: number;
  unitPrice: number;
}

export function OrderActions({
  orderId,
  status,
  defaultWarehouseId,
  warehouses,
  items,
  currency,
}: {
  orderId: string;
  status: string;
  defaultWarehouseId: string;
  warehouses: { id: string; name: string; code: string }[];
  items: OrderItem[];
  currency: CurrencyCode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId || warehouses[0]?.id || '');
  const [courier, setCourier] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [delivered, setDelivered] = useState(false);

  const canPack = status === 'SYNCED' || status === 'PACKING';
  const canFulfill = status !== 'CANCELLED' && status !== 'RETURNED' && items.some((i) => i.quantity - i.fulfilledQty > 0);
  const canReturn = items.some((i) => i.fulfilledQty - i.returnedQty > 0);

  function runPack() {
    startTransition(async () => {
      const res = await packEcommerceOrderAction({ orderId });
      if (res && 'error' in res && res.error) return setMessage({ type: 'err', text: res.error });
      if (res && 'success' in res && res.success) {
        setMessage({ type: 'ok', text: 'Order packed' });
        router.refresh();
      }
    });
  }

  function runFulfill() {
    if (!warehouseId) return setMessage({ type: 'err', text: 'Select a warehouse' });
    startTransition(async () => {
      const res = await fulfillEcommerceOrderAction({
        orderId,
        warehouseId,
        courier: courier || undefined,
        trackingNo: trackingNo || undefined,
        delivered,
      });
      if (res && 'error' in res && res.error) return setMessage({ type: 'err', text: res.error });
      if (res && 'success' in res && res.success) {
        setMessage({ type: 'ok', text: delivered ? 'Order marked delivered' : 'Order shipped' });
        setCourier('');
        setTrackingNo('');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {canPack && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">Pack order</div>
          <div className="text-xs text-muted-foreground">
            Marks all line items as packed and ready for shipment.
          </div>
          <Button variant="dark" className="w-full" disabled={pending} onClick={runPack}>
            {pending ? 'Saving…' : 'Pack order'}
          </Button>
        </Card>
      )}

      {canFulfill && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">Ship / fulfill</div>
          <div className="text-xs text-muted-foreground">
            Remaining quantity ships from the selected warehouse. Stock decrements on save.
          </div>
          <div>
            <Label>Warehouse</Label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Select warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label>Courier</Label>
              <Input value={courier} onChange={(e) => setCourier(e.target.value)} />
            </div>
            <div>
              <Label>Tracking #</Label>
              <Input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input
              id="delivered"
              type="checkbox"
              checked={delivered}
              onChange={(e) => setDelivered(e.target.checked)}
            />
            <label htmlFor="delivered">Already delivered (skip shipped stage)</label>
          </div>
          <Button variant="outline" className="w-full" disabled={pending} onClick={runFulfill}>
            {pending ? 'Saving…' : delivered ? 'Mark delivered' : 'Ship order'}
          </Button>
        </Card>
      )}

      {canReturn && <ReturnForm orderId={orderId} currency={currency} items={items} />}

      {message && (
        <div
          className={`text-sm rounded-md px-3 py-2 ${
            message.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
