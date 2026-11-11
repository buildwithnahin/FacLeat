'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { processBonusApproval } from '@/server/actions/bonus';

type BonusStatus = 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'SUBMITTED';

interface BonusForApproval {
  id: string;
  status: string;
  remarks: string | null;
}

export function ApprovalForm({ bonus }: { bonus: BonusForApproval }) {
  const router = useRouter();
  const [remarks, setRemarks] = useState(bonus.remarks || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApprove = ['DRAFT', 'SUBMITTED', 'PENDING_HR', 'PENDING_MANAGEMENT'].includes(bonus.status);
  const canPublish = bonus.status === 'APPROVED';

  const handleAction = async (status: BonusStatus) => {
    if ((status === 'REJECTED' || status === 'APPROVED') && !remarks.trim()) {
      toast.error('Remarks are required for this action');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await processBonusApproval(bonus.id, { status, remarks });

      if (res.success) {
        toast.success(`Bonus successfully marked as ${status}`);
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

  if (bonus.status === 'PUBLISHED' || bonus.status === 'PAID') {
    return (
      <div className="p-4 bg-muted rounded-md text-sm text-center">
        This bonus is locked as it has been {bonus.status.toLowerCase()}. No further approvals are needed.
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
          disabled={!canApprove && !canPublish}
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
              Approve Bonus
            </Button>
            <Button variant="destructive" className="w-full" onClick={() => handleAction('REJECTED')} disabled={isSubmitting}>
              Reject Bonus
            </Button>
            {bonus.status === 'DRAFT' && (
              <Button variant="outline" className="w-full" onClick={() => handleAction('SUBMITTED')} disabled={isSubmitting}>
                Submit for HR Review
              </Button>
            )}
          </>
        )}

        {canPublish && (
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleAction('PUBLISHED')} disabled={isSubmitting}>
            Publish (Ready for Payroll)
          </Button>
        )}
      </div>
    </div>
  );
}
