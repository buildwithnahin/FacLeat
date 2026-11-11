'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  updateStockTransferStatusAction,
  type StockRequisitionFormState,
} from '@/server/actions/stock-requisitions';

export function StockTransferStatusForm({
  transferId,
  actions,
}: {
  transferId: string;
  actions: { status: 'PACKED' | 'DISPATCHED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'; label: string; dark?: boolean }[];
}) {
  const [state, formAction, pending] = useActionState<StockRequisitionFormState, FormData>(
    updateStockTransferStatusAction,
    undefined,
  );
  const [status, setStatus] = useState(actions[0]?.status ?? 'PACKED');

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="transferId" value={transferId} />
      <div className="space-y-2">
        <Label htmlFor={`dispatch-note-${transferId}`}>Workflow note</Label>
        <Textarea id={`dispatch-note-${transferId}`} name="dispatchNote" rows={2} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.status}
            type="submit"
            name="status"
            value={action.status}
            variant={action.dark ? 'dark' : 'outline'}
            disabled={pending}
            onClick={() => setStatus(action.status)}
          >
            {pending && status === action.status ? `${action.label}…` : action.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
