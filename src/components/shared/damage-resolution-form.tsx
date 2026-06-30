'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WorkflowFormState } from '@/server/actions/warehouse-workflows';

export function DamageResolutionForm({
  reportId,
  action,
  rejectAction,
  suppliers,
  grns,
  purchaseInvoices,
  disabled,
}: {
  reportId: string;
  action: (prev: WorkflowFormState, formData: FormData) => Promise<WorkflowFormState>;
  rejectAction: (prev: WorkflowFormState, formData: FormData) => Promise<WorkflowFormState>;
  suppliers: { id: string; name: string; code: string }[];
  grns: { id: string; number: string; supplierId: string }[];
  purchaseInvoices: { id: string; number: string; supplierId: string }[];
  disabled?: boolean;
}) {
  const [resolveState, resolveFormAction, resolvePending] =
    useActionState<WorkflowFormState, FormData>(action, undefined);
  const [rejectState, rejectFormAction, rejectPending] =
    useActionState<WorkflowFormState, FormData>(rejectAction, undefined);
  const [resolution, setResolution] = useState('SCRAP');
  const [supplierId, setSupplierId] = useState('');

  return (
    <div className="space-y-6">
      <form action={resolveFormAction}>
        <input type="hidden" name="id" value={reportId} />
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resolution">Final action</Label>
              <select
                id="resolution"
                name="resolution"
                disabled={disabled}
                value={resolution}
                onChange={(event) => {
                  setResolution(event.target.value);
                  if (event.target.value !== 'SUPPLIER_CLAIM') setSupplierId('');
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="SCRAP">Scrap</option>
                <option value="REPAIR">Repair / rework</option>
                <option value="B_GRADE">Convert to B-grade</option>
                <option value="SUPPLIER_CLAIM">Supplier claim</option>
              </select>
            </div>
            {resolution === 'SUPPLIER_CLAIM' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="supplierId">Supplier</Label>
                  <select
                    id="supplierId"
                    name="supplierId"
                    value={supplierId}
                    onChange={(event) => setSupplierId(event.target.value)}
                    disabled={disabled}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name} ({supplier.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="grnId">GRN reference</Label>
                    <select
                      id="grnId"
                      name="grnId"
                      disabled={disabled}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="">Select GRN (optional if invoice chosen)</option>
                      {grns
                        .filter((grn) => !supplierId || grn.supplierId === supplierId)
                        .map((grn) => (
                          <option key={grn.id} value={grn.id}>
                            {grn.number}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchaseInvoiceId">Purchase invoice</Label>
                    <select
                      id="purchaseInvoiceId"
                      name="purchaseInvoiceId"
                      disabled={disabled}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="">Select invoice (optional if GRN chosen)</option>
                      {purchaseInvoices
                        .filter((invoice) => !supplierId || invoice.supplierId === supplierId)
                        .map((invoice) => (
                          <option key={invoice.id} value={invoice.id}>
                            {invoice.number}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="claimAmount">Claim amount</Label>
                    <input
                      id="claimAmount"
                      name="claimAmount"
                      type="text"
                      inputMode="decimal"
                      disabled={disabled}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claimReference">Claim reference</Label>
                    <input
                      id="claimReference"
                      name="claimReference"
                      type="text"
                      disabled={disabled}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      placeholder="Email / note / case reference"
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="resolutionNote">Resolution note</Label>
              <Textarea id="resolutionNote" name="resolutionNote" rows={3} disabled={disabled} />
            </div>
            {resolveState?.error && <p className="text-sm text-destructive">{resolveState.error}</p>}
            {!disabled && (
              <Button type="submit" disabled={resolvePending}>
                {resolvePending ? 'Saving…' : 'Resolve report'}
              </Button>
            )}
          </CardContent>
        </Card>
      </form>

      {!disabled && (
        <form action={rejectFormAction}>
          <input type="hidden" name="id" value={reportId} />
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reject-note">Rejection note</Label>
                <Textarea id="reject-note" name="resolutionNote" rows={3} placeholder="Why this report is being rejected and stock restored" />
              </div>
              {rejectState?.error && <p className="text-sm text-destructive">{rejectState.error}</p>}
              <Button type="submit" variant="outline" disabled={rejectPending}>
                {rejectPending ? 'Saving…' : 'Reject report and restore stock'}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
