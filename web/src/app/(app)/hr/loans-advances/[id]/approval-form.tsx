'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { loanApprovalSchema, LoanFormValues } from '@/server/validators/loans';
import { processLoanApprovalAction } from '@/server/actions/loans';
import { ShieldCheck } from 'lucide-react';

type LoanStatus = LoanFormValues['status'];

export function LoanApprovalForm({
  loanId,
  currentStatus,
  isAdmin: _isAdmin,
}: {
  loanId: string;
  currentStatus: string;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(loanApprovalSchema),
    defaultValues: {
      status: currentStatus as LoanStatus,
      remarks: '',
    },
  });

  const isWorkflowActive = ['SUBMITTED', 'PENDING_HR', 'PENDING_ACCOUNTS', 'PENDING_MANAGEMENT', 'APPROVED'].includes(currentStatus);

  if (!isWorkflowActive) {
    return null;
  }

  let nextAction = '';
  let nextStatus: LoanStatus = currentStatus as LoanStatus;
  let approveLabel = 'Approve';

  switch (currentStatus) {
    case 'SUBMITTED':
      nextAction = 'HR Review';
      nextStatus = 'PENDING_HR';
      approveLabel = 'Acknowledge (HR)';
      break;
    case 'PENDING_HR':
      nextAction = 'Accounts Review';
      nextStatus = 'PENDING_ACCOUNTS';
      approveLabel = 'Verify (Accounts)';
      break;
    case 'PENDING_ACCOUNTS':
      nextAction = 'Management Approval';
      nextStatus = 'PENDING_MANAGEMENT';
      approveLabel = 'Send to Management';
      break;
    case 'PENDING_MANAGEMENT':
      nextAction = 'Final Approval';
      nextStatus = 'APPROVED';
      approveLabel = 'Approve Request';
      break;
    case 'APPROVED':
      nextAction = 'Disburse Funds';
      nextStatus = 'DISBURSED';
      approveLabel = 'Mark as Disbursed';
      break;
  }

  function onSubmit(data: { status: LoanStatus; remarks?: string | null }) {
    startTransition(async () => {
      const res = await processLoanApprovalAction(loanId, data);
      if (res.success) {
        toast.success(`Request marked as ${data.status.replace(/_/g, ' ')}`);
        form.reset({ status: data.status, remarks: '' });
      } else {
        toast.error(res.error || 'Failed to process approval');
      }
    });
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20 pb-4">
        <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <ShieldCheck className="h-5 w-5" />
          {nextAction}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Remarks / Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add notes for this step..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={isPending}
                onClick={() => {
                  form.setValue('status', 'REJECTED');
                  form.handleSubmit(onSubmit)();
                }}
              >
                Reject
              </Button>
              <Button
                type="button"
                className="flex-[2] bg-blue-600 hover:bg-blue-700"
                disabled={isPending}
                onClick={() => {
                  form.setValue('status', nextStatus);
                  form.handleSubmit(onSubmit)();
                }}
              >
                {approveLabel}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
