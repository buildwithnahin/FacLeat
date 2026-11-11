'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  assignStockRequisitionWarehouseAction,
  type StockRequisitionFormState,
} from '@/server/actions/stock-requisitions';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm';

export function AssignWarehouseForm({
  requisitionId,
  warehouses,
}: {
  requisitionId: string;
  warehouses: { id: string; name: string; code: string; branchName: string }[];
}) {
  const [state, formAction, pending] = useActionState<StockRequisitionFormState, FormData>(
    assignStockRequisitionWarehouseAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="requisitionId" value={requisitionId} />
      <div className="space-y-2">
        <Label htmlFor="sourceWarehouseId">Source warehouse</Label>
        <select
          id="sourceWarehouseId"
          name="sourceWarehouseId"
          required
          defaultValue={warehouses[0]?.id ?? ''}
          className={selectClass}
        >
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name} ({warehouse.code}) · {warehouse.branchName}
            </option>
          ))}
        </select>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? 'Assigning…' : 'Assign warehouse'}
        </Button>
      </div>
    </form>
  );
}
