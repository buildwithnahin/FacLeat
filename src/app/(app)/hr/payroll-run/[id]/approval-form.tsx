'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { approvePayrollAction, closePayrollAction } from '@/server/actions/payroll-run';

export function ApprovalForm({ run }: { run: any }) {
  const router = useRouter();
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canHRApprove = run.status === 'CALCULATED';
  const canFinanceApprove = run.status === 'PENDING_FINANCE';
  const canManagementApprove = run.status === 'PENDING_MANAGEMENT';
  const canReject = ['CALCULATED', 'PENDING_HR', 'PENDING_FINANCE', 'PENDING_MANAGEMENT'].includes(run.status);
  const canClose = run.status === 'APPROVED' || run.status === 'PAID';
  const isClosed = run.status === 'COMPLETED' || run.status === 'CLOSED';

  const handleApprove = async (level: 'HR' | 'FINANCE' | 'MANAGEMENT') => {
    setIsSubmitting(true);
    try {
      const res = await approvePayrollAction(run.id, {
        level,
        status: 'APPROVED',
        remarks,
      });

      if (res.success) {
        toast.success(`Payroll successfully approved by ${level}`);
        router.refresh();
      } else {
        toast.error(res.error || 'Action failed');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!remarks.trim()) {
      toast.error('Remarks are required for rejection');
      return;
    }

    setIsSubmitting(true);
    try {
      let level = 'HR';
      if (canFinanceApprove) level = 'FINANCE';
      if (canManagementApprove) level = 'MANAGEMENT';

      const res = await approvePayrollAction(run.id, {
        level,
        status: 'REJECTED',
        remarks,
      });

      if (res.success) {
        toast.success(`Payroll rejected successfully`);
        router.refresh();
      } else {
        toast.error(res.error || 'Action failed');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async () => {
    setIsSubmitting(true);
    try {
      const res = await closePayrollAction(run.id);

      if (res.success) {
        toast.success(`Payroll Period successfully Closed!`);
        router.refresh();
      } else {
        toast.error(res.error || 'Action failed');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isClosed) {
    return (
      <div className="p-4 bg-muted rounded-md text-sm text-center border">
        This payroll is <strong>{run.status}</strong>. All related bonuses, loans, and adjustments have been marked as APPLIED/PAID and are permanently locked.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Approval Remarks</Label>
        <Textarea 
          placeholder="Enter comments or reason for rejection..." 
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          disabled={!canReject}
        />
      </div>

      <div className="flex flex-col gap-2 pt-2">
        {canHRApprove && (
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => handleApprove('HR')}
            disabled={isSubmitting}
          >
            HR Approval
          </Button>
        )}
        
        {canFinanceApprove && (
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => handleApprove('FINANCE')}
            disabled={isSubmitting}
          >
            Finance Approval
          </Button>
        )}

        {canManagementApprove && (
          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleApprove('MANAGEMENT')}
            disabled={isSubmitting}
          >
            Management Approval
          </Button>
        )}

        {canReject && (
          <Button 
            variant="destructive"
            className="w-full"
            onClick={handleReject}
            disabled={isSubmitting}
          >
            Reject Payroll
          </Button>
        )}

        {canClose && (
          <div className="pt-4 border-t space-y-2">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 rounded-md text-xs border border-amber-200 dark:border-amber-800">
              Closing Payroll will permanently lock this period and update all linked modules (Loans, Bonus, Adjustments).
            </div>
            <Button 
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Close Payroll
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
