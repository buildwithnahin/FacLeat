'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { processPayrollAdjustmentApproval } from '@/server/actions/payroll-adjustments';

type PayrollAdjustmentStatus = 'APPROVED' | 'REJECTED' | 'SUBMITTED';

interface AdjustmentForApproval {
  id: string;
  status: string;
  remarks: string | null;
}

export function ApprovalForm({ adjustment }: { adjustment: AdjustmentForApproval }) {
  const router = useRouter();
  const [remarks, setRemarks] = useState(adjustment.remarks || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApprove = ['DRAFT', 'SUBMITTED', 'PENDING_HR', 'PENDING_MANAGEMENT'].includes(adjustment.status);
  const isApproved = adjustment.status === 'APPROVED';
  const isApplied = ['APPLIED', 'COMPLETED'].includes(adjustment.status);

  const handleAction = async (status: PayrollAdjustmentStatus) => {
    if (status === 'REJECTED' && !remarks.trim()) {
      toast.error('Remarks are required for rejection');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await processPayrollAdjustmentApproval(adjustment.id, { status, remarks });

      if (res.success) {
        toast.success(`Adjustment successfully marked as ${status}`);
        router.refresh();
      } else {
        toast.error(res.error || 'Action failed');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isApplied) {
    return (
      <div className="p-4 bg-muted rounded-md text-sm text-center">
        This adjustment has been <strong>{adjustment.status}</strong> to payroll and is now locked. No further
        modifications can be made.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Approval Remarks</Label>
        <Textarea
          placeholder="Enter comments or reason for approval/rejection..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={!canApprove}
        />
      </div>

      <div className="flex flex-col gap-2 pt-2">
        {canApprove && (
          <>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleAction('APPROVED')}
              disabled={isSubmitting}
            >
              Approve Adjustment
            </Button>

            <Button variant="destructive" className="w-full" onClick={() => handleAction('REJECTED')} disabled={isSubmitting}>
              Reject Adjustment
            </Button>

            {adjustment.status === 'DRAFT' && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleAction('SUBMITTED')}
                disabled={isSubmitting}
              >
                Submit for Review
              </Button>
            )}
          </>
        )}

        {isApproved && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-md text-sm text-center border border-emerald-200 dark:border-emerald-800">
            This adjustment is Approved and ready to be automatically applied during the next Payroll Run.
          </div>
        )}
      </div>
    </div>
  );
}
