'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  decideStockRequisitionAction,
  type StockRequisitionFormState,
} from '@/server/actions/stock-requisitions';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm';

export function StockRequisitionDecisionForm({
  requisitionId,
  sourceWarehouseId,
  items,
  warehouses,
}: {
  requisitionId: string;
  sourceWarehouseId?: string | null;
  items: { id: string; productName: string; requestedQty: string; approvedQty: string }[];
  warehouses: { id: string; name: string; code: string; branchName: string }[];
}) {
  const [state, formAction, pending] = useActionState<StockRequisitionFormState, FormData>(
    decideStockRequisitionAction,
    undefined,
  );
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [rows, setRows] = useState(
    items.map((item) => ({
      itemId: item.id,
      approvedQty: item.approvedQty === '0' ? item.requestedQty : item.approvedQty,
    })),
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="requisitionId" value={requisitionId} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="itemsJson" value={JSON.stringify(rows)} />

      <div className="space-y-2">
        <Label>Source warehouse</Label>
        <select
          name="sourceWarehouseId"
          defaultValue={sourceWarehouseId ?? ''}
          className={selectClass}
        >
          <option value="">Assign later</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name} ({warehouse.code}) · {warehouse.branchName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="grid gap-2 md:grid-cols-[2fr_120px_120px] md:items-end">
            <div>
              <Label className="text-xs">{item.productName}</Label>
              <div className="text-xs text-muted-foreground">Requested: {item.requestedQty}</div>
            </div>
            <div>
              <Label className="text-xs">Approved qty</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={rows.find((row) => row.itemId === item.id)?.approvedQty ?? '0'}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((row) =>
                      row.itemId === item.id ? { ...row, approvedQty: event.target.value } : row,
                    ),
                  )
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="approvalNote">Approval note</Label>
        <Textarea id="approvalNote" name="approvalNote" rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rejectionReason">Rejection reason</Label>
        <Textarea id="rejectionReason" name="rejectionReason" rows={3} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          onClick={() => setDecision('REJECT')}
        >
          {pending && decision === 'REJECT' ? 'Rejecting…' : 'Reject'}
        </Button>
        <Button
          type="submit"
          variant="dark"
          disabled={pending}
          onClick={() => setDecision('APPROVE')}
        >
          {pending && decision === 'APPROVE' ? 'Approving…' : 'Approve'}
        </Button>
      </div>
    </form>
  );
}
