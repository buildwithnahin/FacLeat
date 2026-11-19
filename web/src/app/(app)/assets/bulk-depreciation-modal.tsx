'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { depreciateBulkAssetsAction } from '@/server/actions/assets';
import { formatCurrency } from '@/lib/money';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface BulkDepreciationModalProps {
  branches: BranchOption[];
  currentBranchId?: string;
}

export function BulkDepreciationModal({
  branches,
  currentBranchId,
}: BulkDepreciationModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState(currentBranchId ?? '');
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    // Default to last day of current month
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return lastDay.toISOString().slice(0, 10);
  });

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodEnd) {
      toast.error('Period end date is required');
      return;
    }

    startTransition(async () => {
      const res = await depreciateBulkAssetsAction({
        branchId: branchId || undefined,
        periodEnd,
      });

      if (res.success) {
        toast.success(
          `Depreciation posted for ${res.postedCount} asset(s). Total Expense: ${formatCurrency(res.totalExpense ?? 0, 'BDT')}`,
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to post bulk depreciation');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 shadow-sm text-xs">
          <Calculator className="h-3.5 w-3.5 text-primary" /> Run Depreciation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleRun}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <span>Bulk Period Depreciation</span>
            </DialogTitle>
            <DialogDescription>
              Calculate and post monthly depreciation expense for all eligible fixed assets across the selected branch.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="deprBranch">Branch Scope</Label>
              <select
                id="deprBranch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="">All Scoped Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deprPeriod">Period End Date *</Label>
              <Input
                id="deprPeriod"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Computes straight-line / declining balance charges through this cut-off date.
              </p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Financial Impact Notice</p>
                <p className="text-amber-800/90 mt-0.5">
                  Assets that have already reached salvage value or have been disposed are automatically excluded.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="gap-1.5">
              {pending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Processing Run...
                </>
              ) : (
                'Post Depreciation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
