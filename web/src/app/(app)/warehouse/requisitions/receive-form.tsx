'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  receiveStockTransferAction,
  type StockRequisitionFormState,
} from '@/server/actions/stock-requisitions';

export function StockReceiveForm({
  transferId,
  items,
}: {
  transferId: string;
  items: { id: string; productName: string; quantity: string }[];
}) {
  const [state, formAction, pending] = useActionState<StockRequisitionFormState, FormData>(
    receiveStockTransferAction,
    undefined,
  );
  const [rows, setRows] = useState(
    items.map((item) => ({
      itemId: item.id,
      receivedQty: item.quantity,
      damagedQty: '0',
      missingQty: '0',
    })),
  );

  const getRowAccounted = (itemId: string) => {
    const row = rows.find((r) => r.itemId === itemId);
    if (!row) return 0;
    return Number(row.receivedQty || 0) + Number(row.damagedQty || 0) + Number(row.missingQty || 0);
  };

  const isRowBalanced = (item: { id: string; quantity: string }) => {
    const total = getRowAccounted(item.id);
    return Math.abs(total - Number(item.quantity)) < 0.0001;
  };

  const allBalanced = items.every(isRowBalanced);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="transferId" value={transferId} />
      <input type="hidden" name="itemsJson" value={JSON.stringify(rows)} />

      <div className="space-y-3">
        {items.map((item) => {
          const balanced = isRowBalanced(item);
          const accounted = getRowAccounted(item.id);
          return (
            <div
              key={item.id}
              className="grid gap-2 md:grid-cols-[2fr_120px_120px_120px] md:items-end rounded-lg border p-3"
            >
              <div>
                <Label className="text-xs">{item.productName}</Label>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span>Dispatched: {item.quantity}</span>
                  <span className={balanced ? 'text-emerald-600 font-medium' : 'text-destructive font-medium'}>
                    (Accounted: {accounted} / {item.quantity})
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-xs">Received</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rows.find((row) => row.itemId === item.id)?.receivedQty ?? '0'}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((row) =>
                        row.itemId === item.id ? { ...row, receivedQty: event.target.value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Damaged</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rows.find((row) => row.itemId === item.id)?.damagedQty ?? '0'}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((row) =>
                        row.itemId === item.id ? { ...row, damagedQty: event.target.value } : row,
                      ),
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Missing</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rows.find((row) => row.itemId === item.id)?.missingQty ?? '0'}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((row) =>
                        row.itemId === item.id ? { ...row, missingQty: event.target.value } : row,
                      ),
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor="receiveRemarks">Receive remarks</Label>
        <Textarea id="receiveRemarks" name="receiveRemarks" rows={3} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {!allBalanced && (
        <p className="text-xs text-amber-600">
          The sum of Received, Damaged, and Missing must equal the dispatched quantity for each item.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="dark" disabled={pending || !allBalanced}>
          {pending ? 'Confirming…' : 'Confirm receipt'}
        </Button>
      </div>
    </form>
  );
}
