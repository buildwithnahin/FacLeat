'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { WorkflowFormState } from '@/server/actions/warehouse-workflows';

type Item = {
  id: string;
  quantity: string;
  note: string | null;
  disposition?: string | null;
  product: {
    sku: string;
    name: string;
    unit: string;
  };
};

type Decision = {
  itemId: string;
  disposition: 'RESTOCK' | 'REWORK' | 'DAMAGED' | 'REJECT';
  note: string;
};

const DISPOSITION_LABEL: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  RESTOCK: { label: 'Good: Restocked', variant: 'success' },
  REWORK: { label: 'Minor defect: Rework (WIP)', variant: 'warning' },
  DAMAGED: { label: 'Major defect: Damaged', variant: 'destructive' },
  REJECT: { label: 'Wrong return: Rejected', variant: 'secondary' },
};

export function ReturnInspectionForm({
  returnId,
  items,
  financeAction,
  financeNote,
  inspectionNote,
  action,
  disabled,
}: {
  returnId: string;
  items: Item[];
  financeAction: 'NONE' | 'REFUND' | 'EXCHANGE' | 'CREDIT_ADJUSTMENT';
  financeNote: string | null;
  inspectionNote: string | null;
  action: (prev: WorkflowFormState, formData: FormData) => Promise<WorkflowFormState>;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<WorkflowFormState, FormData>(action, undefined);
  const [decisions, setDecisions] = useState<Decision[]>(
    items.map((item) => ({
      itemId: item.id,
      disposition: (item.disposition as Decision['disposition']) || 'RESTOCK',
      note: item.note ?? '',
    })),
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={returnId} />
      <input type="hidden" name="decisionItemsJson" value={JSON.stringify(decisions)} />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="financeAction">Finance action</Label>
              <select
                id="financeAction"
                name="financeAction"
                defaultValue={financeAction}
                disabled={disabled}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="NONE">None</option>
                <option value="REFUND">Refund</option>
                <option value="EXCHANGE">Exchange</option>
                <option value="CREDIT_ADJUSTMENT">Credit adjustment</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="financeNote">Finance note</Label>
              <Textarea id="financeNote" name="financeNote" rows={2} defaultValue={financeNote ?? ''} disabled={disabled} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inspectionNote">Inspection summary</Label>
            <Textarea id="inspectionNote" name="inspectionNote" rows={3} defaultValue={inspectionNote ?? ''} disabled={disabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">SKU</th>
                <th className="px-4 py-3 text-left font-semibold">Product</th>
                <th className="px-4 py-3 text-right font-semibold">Qty</th>
                <th className="px-4 py-3 text-left font-semibold">Decision</th>
                <th className="px-4 py-3 text-left font-semibold">Line note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-mono text-xs">{item.product.sku}</td>
                  <td className="px-4 py-3">{item.product.name}</td>
                  <td className="px-4 py-3 text-right tabular">
                    {item.quantity} {item.product.unit}
                  </td>
                  <td className="px-4 py-3">
                    {disabled ? (
                      <Badge variant={DISPOSITION_LABEL[decisions[index]?.disposition ?? 'RESTOCK']?.variant ?? 'secondary'}>
                        {DISPOSITION_LABEL[decisions[index]?.disposition ?? 'RESTOCK']?.label ?? decisions[index]?.disposition}
                      </Badge>
                    ) : (
                      <select
                        value={decisions[index]?.disposition ?? 'RESTOCK'}
                        onChange={(event) =>
                          setDecisions((prev) => {
                            const next = [...prev];
                            const current = next[index];
                            if (current) {
                              next[index] = {
                                ...current,
                                disposition: event.target.value as Decision['disposition'],
                              };
                            }
                            return next;
                          })
                        }
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="RESTOCK">Good: restock</option>
                        <option value="REWORK">Minor defect: rework</option>
                        <option value="DAMAGED">Major defect: damaged stock</option>
                        <option value="REJECT">Wrong return: reject</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Textarea
                      rows={2}
                      value={decisions[index]?.note ?? ''}
                      disabled={disabled}
                      onChange={(event) =>
                        setDecisions((prev) => {
                          const next = [...prev];
                          const current = next[index];
                          if (current) next[index] = { ...current, note: event.target.value };
                          return next;
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      {!disabled && (
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Complete inspection'}
          </Button>
        </div>
      )}
    </form>
  );
}
