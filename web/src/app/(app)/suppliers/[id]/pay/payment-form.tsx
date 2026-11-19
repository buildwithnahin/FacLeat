'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  recordSupplierPaymentAction,
  type PaymentFormState,
} from '@/server/actions/suppliers';

const METHODS = [
  ['BANK_TRANSFER', 'Bank transfer'],
  ['CASH', 'Cash disbursement'],
  ['CHEQUE', 'Cheque'],
  ['WIRE_TRANSFER', 'Wire transfer'],
  ['MOBILE_BANKING', 'Mobile banking (bKash/Nagad)'],
  ['OTHER', 'Other'],
] as const;

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm';

export interface PaymentFormProps {
  supplierId: string;
  supplierName: string;
  currency: string;
  totalDue: string;
  openInvoices: {
    id: string;
    number: string;
    grandTotal: string;
    paidAmount: string;
    dueDate: string;
  }[];
}

export function PaymentForm({
  supplierId,
  supplierName,
  currency,
  totalDue,
  openInvoices,
}: PaymentFormProps) {
  const router = useRouter();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(
    recordSupplierPaymentAction,
    undefined,
  );
  const E = (f: string) => state?.fieldErrors?.[f]?.[0];

  useEffect(() => {
    if (state?.success) {
      toast.success(`Payment voucher recorded successfully for ${supplierName}`);
      router.push(`/suppliers/${supplierId}/ledger`);
    }
  }, [state?.success, supplierName, supplierId, router]);

  const selectedInvoice = openInvoices.find((inv) => inv.id === selectedInvoiceId);
  const selectedInvoiceDue = selectedInvoice
    ? Math.max(0, Number(selectedInvoice.grandTotal) - Number(selectedInvoice.paidAmount))
    : 0;

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    if (invId) {
      const inv = openInvoices.find((i) => i.id === invId);
      if (inv) {
        const due = Math.max(0, Number(inv.grandTotal) - Number(inv.paidAmount));
        setAmount(due.toFixed(2));
      }
    }
  };

  const handlePayFullDue = () => {
    if (selectedInvoiceId && selectedInvoiceDue > 0) {
      setAmount(selectedInvoiceDue.toFixed(2));
    } else if (Number(totalDue) > 0) {
      setAmount(Number(totalDue).toFixed(2));
    }
  };

  const numAmount = Number(amount) || 0;
  const currentTotalDue = Number(totalDue) || 0;
  const projectedRemaining = Math.max(0, currentTotalDue - numAmount);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="supplierId" value={supplierId} />

      {/* Financial Context Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Vendor Outstanding</p>
          <p className={`text-2xl font-black mt-1 ${currentTotalDue > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
            {currency} {currentTotalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Across all open orders & unapplied balances</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Balance After This Payment</p>
          <p className="text-2xl font-black mt-1 text-foreground">
            {currency} {projectedRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {numAmount > 0 ? `Reduction of ${currency} ${numAmount.toFixed(2)}` : 'Enter amount to simulate'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="invoiceId">Apply to Specific Purchase Invoice (optional)</Label>
            <select
              id="invoiceId"
              name="invoiceId"
              value={selectedInvoiceId}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              className={selectClass}
            >
              <option value="">— On-Account / General Advance Payment —</option>
              {openInvoices.map((inv) => {
                const due = Math.max(0, Number(inv.grandTotal) - Number(inv.paidAmount));
                return (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} · Due: {currency} {due.toFixed(2)} (Total: {inv.grandTotal}) · Due Date: {new Date(inv.dueDate).toLocaleDateString()}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-muted-foreground">
              Selecting an invoice updates its payment status (PAID or PARTIALLY_PAID) in the Accounts Payable ledger.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">
                Payment Amount ({currency}) <span className="text-destructive">*</span>
              </Label>
              {(currentTotalDue > 0 || selectedInvoiceDue > 0) && (
                <button
                  type="button"
                  onClick={handlePayFullDue}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {selectedInvoiceId ? 'Pay invoice due' : 'Pay total due'}
                </button>
              )}
            </div>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            {E('amount') && <p className="text-xs text-destructive">{E('amount')}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate">
              Payment Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="paymentDate"
              name="paymentDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Payment Method / Tender</Label>
            <select id="method" name="method" defaultValue="BANK_TRANSFER" className={selectClass}>
              {METHODS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Payment Reference / Txn ID</Label>
            <Input id="reference" name="reference" placeholder="e.g. CHQ-99824 or bKash TrxID" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Disbursement Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Additional internal audit notes or bank narrative..."
            />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm font-medium text-destructive">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? 'Recording Voucher…' : 'Confirm & Record Payment'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={`/suppliers/${supplierId}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
