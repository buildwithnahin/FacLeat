'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, type CurrencyCode } from '@/lib/money';
import { returnEcommerceOrderAction } from '@/server/actions/ecommerce';
import { POS_PAYMENT_METHODS } from '@/server/validators/pos';

interface ReturnItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  fulfilledQty: number;
  returnedQty: number;
  unitPrice: number;
}

export function ReturnForm({
  orderId,
  currency,
  items,
}: {
  orderId: string;
  currency: CurrencyCode;
  items: ReturnItem[];
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<(typeof POS_PAYMENT_METHODS)[number]>('CASH');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const returnItems = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({ orderItemId: id, quantity: q }));
    if (returnItems.length === 0) {
      setMessage({ type: 'err', text: 'Enter at least one return quantity' });
      return;
    }
    startTransition(async () => {
      const res = await returnEcommerceOrderAction({
        orderId,
        refundMethod: method,
        reason: reason || undefined,
        items: returnItems,
      });
      if (res && 'error' in res && res.error) {
        setMessage({ type: 'err', text: res.error });
        return;
      }
      if (res && 'success' in res && res.success) {
        setMessage({ type: 'ok', text: 'Return recorded' });
        setQty({});
        router.refresh();
      }
    });
  }

  const hasReturnable = items.some((i) => i.fulfilledQty - i.returnedQty > 0);

  return (
    <Card className="p-4 space-y-3">
      <div className="text-sm font-medium">Return items</div>
      {!hasReturnable && (
        <div className="text-sm text-muted-foreground">Nothing fulfilled yet to return.</div>
      )}
      <div className="space-y-2">
        {items.map((i) => {
          const remaining = i.fulfilledQty - i.returnedQty;
          const disabled = remaining <= 0;
          return (
            <div key={i.id} className="flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="truncate">{i.name}</div>
                <div className="text-xs text-muted-foreground">
                  {i.sku} · {remaining} fulfilled left · {formatCurrency(i.unitPrice, currency)}
                </div>
              </div>
              <Input
                type="number"
                min={0}
                max={remaining}
                step="any"
                className="w-20 text-right tabular"
                disabled={disabled}
                value={qty[i.id] ?? ''}
                onChange={(e) => setQty((p) => ({ ...p, [i.id]: Number(e.target.value) }))}
              />
            </div>
          );
        })}
      </div>
      <div>
        <Label>Refund method</Label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as (typeof POS_PAYMENT_METHODS)[number])}
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {POS_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Reason</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {message && (
        <div
          className={`text-sm rounded-md px-3 py-2 ${
            message.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}
      <Button
        variant="outline"
        onClick={submit}
        disabled={pending || !hasReturnable}
        className="w-full"
      >
        {pending ? 'Processing…' : 'Process return'}
      </Button>
    </Card>
  );
}
