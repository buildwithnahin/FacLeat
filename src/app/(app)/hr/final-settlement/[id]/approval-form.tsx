'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { approveSettlementAction, markSettlementPaidAction } from '@/server/actions/final-settlements';

export function ApprovalForm({ fs }: { fs: any }) {
  const router = useRouter();
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Payment states
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionRef, setTransactionRef] = useState('');

  const canHRApprove = fs.status === 'CALCULATED' || fs.status === 'PENDING_HR';
  const canFinanceApprove = fs.status === 'PENDING_FINANCE';
  const canManagementApprove = fs.status === 'PENDING_MANAGEMENT';
  const canReject = ['CALCULATED', 'PENDING_HR', 'PENDING_FINANCE', 'PENDING_MANAGEMENT'].includes(fs.status);
  const canPay = fs.status === 'APPROVED';
  const isClosed = fs.status === 'PAID' || fs.status === 'CLOSED';
  const isRejected = fs.status === 'REJECTED';

  const handleApprove = async (level: 'HR' | 'FINANCE' | 'MANAGEMENT') => {
    setIsSubmitting(true);
    try {
      const res = await approveSettlementAction(fs.id, {
        level,
        status: 'APPROVED',
        remarks,
      });

      if (res.success) {
        toast.success(`Settlement successfully approved by ${level}`);
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

      const res = await approveSettlementAction(fs.id, {
        level,
        status: 'REJECTED',
        remarks,
      });

      if (res.success) {
        toast.success(`Settlement rejected successfully`);
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

  const handlePay = async () => {
    setIsSubmitting(true);
    try {
      const res = await markSettlementPaidAction(fs.id, {
        paymentMethod,
        paymentDate,
        transactionRef
      });

      if (res.success) {
        toast.success(`Settlement successfully marked as PAID`);
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
      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-md text-sm text-center border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400">
        This final settlement is <strong>{fs.status}</strong>. Payment has been disbursed and active loans have been closed.
      </div>
    );
  }
  
  if (isRejected) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-md text-sm text-center border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400">
        This final settlement was <strong>REJECTED</strong>. Delete and recalculate if needed.
      </div>
    );
  }

  if (canPay) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md text-xs border border-blue-200 dark:border-blue-800 mb-4">
          All approvals are complete. Disburse the final amount to close the settlement.
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2 text-sm">
            <Label>Payment Date</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          
          <div className="space-y-2 text-sm">
            <Label>Transaction Reference</Label>
            <Input placeholder="TXN-XXXX" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} />
          </div>
          
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
            onClick={handlePay}
            disabled={isSubmitting}
          >
            Mark as Paid & Closed
          </Button>
        </div>
      </div>
    )
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
            Reject Settlement
          </Button>
        )}
      </div>
    </div>
  );
}
