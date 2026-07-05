'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createStockDispatchAction,
  type StockRequisitionFormState,
} from '@/server/actions/stock-requisitions';

export function StockDispatchForm({
  requisitionId,
  items,
}: {
  requisitionId: string;
  items: {
    requisitionItemId: string;
    productId: string;
    productName: string;
    approvedRemainingQty: string;
  }[];
}) {
  const [state, formAction, pending] = useActionState<StockRequisitionFormState, FormData>(
    createStockDispatchAction,
    undefined,
  );
  const [rows, setRows] = useState(
    items.map((item) => ({
      requisitionItemId: item.requisitionItemId,
      productId: item.productId,
      quantity: item.approvedRemainingQty,
      note: '',
    })),
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="requisitionId" value={requisitionId} />
      <input type="hidden" name="itemsJson" value={JSON.stringify(rows)} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expectedDate">Expected receive date</Label>
          <Input id="expectedDate" name="expectedDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packedBy">Packed by</Label>
          <Input id="packedBy" name="packedBy" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicle">Vehicle</Label>
          <Input id="vehicle" name="vehicle" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driverName">Driver name</Label>
          <Input id="driverName" name="driverName" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driverPhone">Driver phone</Label>
          <Input id="driverPhone" name="driverPhone" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gatePassNo">Gate pass no</Label>
          <Input id="gatePassNo" name="gatePassNo" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trackingNo">Tracking no</Label>
          <Input id="trackingNo" name="trackingNo" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="remarks">Dispatch remarks</Label>
          <Textarea id="remarks" name="remarks" rows={3} />
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.requisitionItemId} className="grid gap-2 md:grid-cols-[2fr_140px_1fr] md:items-end">
            <div>
              <Label className="text-xs">{item.productName}</Label>
              <div className="text-xs text-muted-foreground">
                Remaining approved: {item.approvedRemainingQty}
              </div>
            </div>
            <div>
              <Label className="text-xs">Dispatch qty</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={rows.find((row) => row.requisitionItemId === item.requisitionItemId)?.quantity ?? '0'}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((row) =>
                      row.requisitionItemId === item.requisitionItemId
                        ? { ...row, quantity: event.target.value }
                        : row,
                    ),
                  )
                }
              />
            </div>
            <div>
              <Label className="text-xs">Note</Label>
              <Input
                value={rows.find((row) => row.requisitionItemId === item.requisitionItemId)?.note ?? ''}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((row) =>
                      row.requisitionItemId === item.requisitionItemId
                        ? { ...row, note: event.target.value }
                        : row,
                    ),
                  )
                }
              />
            </div>
          </div>
        ))}
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? 'Creating dispatch…' : 'Create dispatch'}
        </Button>
      </div>
    </form>
  );
}
