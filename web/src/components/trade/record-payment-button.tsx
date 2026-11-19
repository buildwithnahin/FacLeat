'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createTradePaymentAction } from '@/server/actions/trade';
import { formatCurrency, type CurrencyCode } from '@/lib/money';

interface RecordPaymentButtonProps {
  tradeOrderId: string;
  orderNumber: string;
  branchId: string;
  currency: CurrencyCode;
  defaultExchangeRate: number | string;
  totalValue: number | string;
  existingPaymentsTotal?: number | string;
}

export function RecordPaymentButton({
  tradeOrderId,
  orderNumber,
  branchId,
  currency,
  defaultExchangeRate,
  totalValue,
  existingPaymentsTotal = 0,
}: RecordPaymentButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const totalNum = Number(totalValue) || 0;
  const paidNum = Number(existingPaymentsTotal) || 0;
  const remainingNum = Math.max(0, totalNum - paidNum);

  const [amount, setAmount] = useState<string>(remainingNum > 0 ? remainingNum.toFixed(2) : '');
  const [exchangeRate, setExchangeRate] = useState<string>(
    defaultExchangeRate ? Number(defaultExchangeRate).toString() : '122',
  );
  const [bankName, setBankName] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [swiftRef, setSwiftRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [valueDate, setValueDate] = useState('');
  const [notes, setNotes] = useState('');

  const numAmount = Number(amount) || 0;
  const numRate = Number(exchangeRate) || 1;
  const localEquivalentBDT = numAmount * numRate;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (numAmount <= 0) {
      toast.error('Payment amount must be greater than zero');
      return;
    }
    if (numRate <= 0) {
      toast.error('Exchange rate must be greater than zero');
      return;
    }
    if (!paymentDate) {
      toast.error('Payment date is required');
      return;
    }

    startTransition(async () => {
      const res = await createTradePaymentAction({
        tradeOrderId,
        branchId,
        currency,
        amount: numAmount,
        exchangeRate: numRate,
        bankName: bankName.trim() || undefined,
        bankReference: bankReference.trim() || undefined,
        swiftRef: swiftRef.trim() || undefined,
        paymentDate: new Date(paymentDate),
        valueDate: valueDate ? new Date(valueDate) : undefined,
        notes: notes.trim() || undefined,
      });

      if (res?.success) {
        toast.success(`Payment of ${formatCurrency(numAmount.toString(), currency)} recorded successfully!`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res?.error ?? 'Failed to record payment');
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="default"
        onClick={() => {
          setAmount(remainingNum > 0 ? remainingNum.toFixed(2) : '');
          setOpen(true);
        }}
        className="h-8 text-xs font-medium cursor-pointer"
      >
        <DollarSign className="mr-1 h-3.5 w-3.5" />
        Record Payment
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2 text-primary mb-0.5">
                <CreditCard className="h-5 w-5" />
                <DialogTitle>Record Foreign Payment</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Log a foreign remittance, SWIFT TT, or bank transfer for order{' '}
                <span className="font-mono font-medium text-foreground">{orderNumber}</span>.
              </DialogDescription>
            </DialogHeader>

            {/* Order Balance Overview Box */}
            <div className="rounded-lg border bg-muted/40 p-3 text-xs grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-muted-foreground block text-[11px]">Order Total</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCurrency(totalNum.toString(), currency)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Paid</span>
                <span className="font-semibold tabular-nums text-emerald-600">
                  {formatCurrency(paidNum.toString(), currency)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Remaining Due</span>
                <span className="font-semibold tabular-nums text-amber-600">
                  {formatCurrency(remainingNum.toString(), currency)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Payment Amount */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pay-amount" className="text-xs">
                    Amount ({currency}) <span className="text-destructive">*</span>
                  </Label>
                  {remainingNum > 0 && numAmount !== remainingNum && (
                    <button
                      type="button"
                      onClick={() => setAmount(remainingNum.toFixed(2))}
                      className="text-[11px] text-primary hover:underline cursor-pointer"
                    >
                      Fill Full Remaining
                    </button>
                  )}
                </div>
                <Input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* Exchange Rate */}
              <div className="space-y-1.5">
                <Label htmlFor="pay-fx" className="text-xs">
                  Exchange Rate (1 {currency} = ? BDT) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pay-fx"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="122.00"
                />
              </div>

              {/* Bank Name */}
              <div className="space-y-1.5">
                <Label htmlFor="pay-bank" className="text-xs">Bank Name</Label>
                <Input
                  id="pay-bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Standard Chartered Bank"
                />
              </div>

              {/* SWIFT Reference */}
              <div className="space-y-1.5">
                <Label htmlFor="pay-swift" className="text-xs">SWIFT / TT Ref</Label>
                <Input
                  id="pay-swift"
                  value={swiftRef}
                  onChange={(e) => setSwiftRef(e.target.value)}
                  placeholder="e.g. MT103-987654"
                />
              </div>

              {/* Bank Reference */}
              <div className="space-y-1.5">
                <Label htmlFor="pay-bank-ref" className="text-xs">Bank Voucher / Ref</Label>
                <Input
                  id="pay-bank-ref"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  placeholder="e.g. TR-2026-001"
                />
              </div>

              {/* Payment Date */}
              <div className="space-y-1.5">
                <Label htmlFor="pay-date" className="text-xs">
                  Payment Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pay-date"
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            </div>

            {/* Local Equivalent Summary Box */}
            {numAmount > 0 && numRate > 0 && currency !== 'BDT' && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 flex justify-between items-center">
                <span>Equivalent in Local Currency:</span>
                <span className="font-bold tabular-nums text-sm">
                  ৳ {localEquivalentBDT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                </span>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="pay-notes" className="text-xs">Remarks / Notes</Label>
              <Textarea
                id="pay-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional payment notes or correspondent bank charges..."
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  'Confirm & Record Payment'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
