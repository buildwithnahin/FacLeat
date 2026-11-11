'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProductionPlanAction, type FactoryFormState } from '@/server/actions/factory';
import { PRODUCTION_PLAN_PRIORITY } from '@/server/validators/factory';

type Branch = { id: string; name: string; code: string };
type Product = { id: string; sku: string; name: string; unit: string };

const selectClass = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm';

export function ProductionPlanForm({ branches, products }: { branches: Branch[]; products: Product[] }) {
  const [state, action, pending] = useActionState<FactoryFormState, FormData>(
    createProductionPlanAction,
    undefined,
  );
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const fieldErrors: Record<string, string[] | undefined> = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6">
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Plan details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="branchId">Branch *</Label>
            <select
              id="branchId"
              name="branchId"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className={selectClass}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="productId">Product *</Label>
            <select id="productId" name="productId" className={selectClass}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
            {fieldErrors.productId && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.productId[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="quantity">Quantity *</Label>
            <Input id="quantity" name="quantity" type="number" step="0.01" min="0" required />
            {fieldErrors.quantity && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.quantity[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <select id="priority" name="priority" defaultValue="MEDIUM" className={selectClass}>
              {PRODUCTION_PLAN_PRIORITY.map((p) => (
                <option key={p} value={p}>
                  {p.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="planningDate">Planning date *</Label>
            <Input id="planningDate" name="planningDate" type="date" required />
          </div>
          <div />
          <div>
            <Label htmlFor="plannedStartDate">Planned start *</Label>
            <Input id="plannedStartDate" name="plannedStartDate" type="date" required />
          </div>
          <div>
            <Label htmlFor="plannedEndDate">Planned end *</Label>
            <Input id="plannedEndDate" name="plannedEndDate" type="date" required />
            {fieldErrors.plannedEndDate && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.plannedEndDate[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="productionLine">Production line</Label>
            <Input id="productionLine" name="productionLine" />
          </div>
          <div>
            <Label htmlFor="machine">Machine</Label>
            <Input id="machine" name="machine" />
          </div>
          <div>
            <Label htmlFor="shift">Shift</Label>
            <Input id="shift" name="shift" />
          </div>
        </div>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? 'Creating…' : 'Create Plan'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/factory/planning">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
