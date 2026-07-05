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

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="transferId" value={transferId} />
      <input type="hidden" name="itemsJson" value={JSON.stringify(rows)} />

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-2 md:grid-cols-[2fr_120px_120px_120px] md:items-end"
          >
            <div>
              <Label className="text-xs">{item.productName}</Label>
              <div className="text-xs text-muted-foreground">Dispatched: {item.quantity}</div>
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
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="receiveRemarks">Receive remarks</Label>
        <Textarea id="receiveRemarks" name="receiveRemarks" rows={3} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? 'Confirming…' : 'Confirm receipt'}
        </Button>
      </div>
    </form>
  );
}
