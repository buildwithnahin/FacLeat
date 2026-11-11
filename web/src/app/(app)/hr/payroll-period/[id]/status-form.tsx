'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { payrollPeriodStatusSchema, PayrollPeriodFormValues } from '@/server/validators/payroll-periods';
import { changePayrollPeriodStatus } from '@/server/actions/payroll-periods';
import { AlertCircle, CheckCircle, Play, Lock, Unlock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type PayrollPeriodStatus = PayrollPeriodFormValues['status'];

export function PeriodStatusForm({
  periodId,
  currentStatus,
  isAdmin,
}: {
  periodId: string;
  currentStatus: string;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(payrollPeriodStatusSchema),
    defaultValues: {
      status: currentStatus as PayrollPeriodStatus,
      reason: '',
    },
  });

  const watchStatus = form.watch('status');
  const needsReason = currentStatus === 'CLOSED' && watchStatus === 'OPEN';

  function updateStatus(newStatus: PayrollPeriodStatus) {
    if (newStatus === currentStatus) return;
    form.setValue('status', newStatus);

    // Auto-submit if not reopening
    if (!(currentStatus === 'CLOSED' && newStatus === 'OPEN')) {
      form.handleSubmit(onSubmit)();
    }
  }

  function onSubmit(data: { status: PayrollPeriodStatus; reason?: string }) {
    startTransition(async () => {
      const res = await changePayrollPeriodStatus(periodId, data);
      if (res.success) {
        toast.success(`Period marked as ${data.status}`);
        form.reset({ status: data.status, reason: '' });
      } else {
        toast.error(res.error || 'Failed to update status');
        form.setValue('status', currentStatus as PayrollPeriodStatus); // Revert UI
      }
    });
  }

  return (
    <Card className={currentStatus === 'OPEN' ? 'border-blue-500 shadow-sm' : ''}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {currentStatus === 'OPEN' ? (
            <Play className="h-5 w-5 text-blue-500" />
          ) : currentStatus === 'CLOSED' ? (
            <Lock className="h-5 w-5 text-emerald-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-slate-500" />
          )}
          Period Status Control
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentStatus === 'DRAFT' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ready to Start?</AlertTitle>
              <AlertDescription>
                Opening the period allows attendance and leave data to be imported for this month.
              </AlertDescription>
            </Alert>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isPending} onClick={() => updateStatus('OPEN')}>
              Open Payroll Period
            </Button>
          </div>
        )}

        {currentStatus === 'OPEN' && (
          <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200">
              <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle>Period is Active</AlertTitle>
              <AlertDescription>Payroll processing is allowed. Lock the period when all salaries are paid.</AlertDescription>
            </Alert>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isPending}
              onClick={() => updateStatus('CLOSED')}
            >
              Close & Lock Period
            </Button>
          </div>
        )}

        {currentStatus === 'CLOSED' && (
          <div className="space-y-4">
            <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200">
              <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle>Period Locked</AlertTitle>
              <AlertDescription>No further edits allowed. Historical data is preserved.</AlertDescription>
            </Alert>

            {isAdmin && (
              <div className="mt-6 pt-4 border-t">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                    <p className="text-sm font-medium text-destructive flex items-center gap-2">
                      <Unlock className="h-4 w-4" /> Admin: Reopen Period
                    </p>

                    {needsReason && (
                      <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Reason for Reopening *</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Required for audit logs..." {...field} required />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {!needsReason ? (
                      <Button type="button" variant="destructive" className="w-full" disabled={isPending} onClick={() => updateStatus('OPEN')}>
                        Reopen (Corrections)
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => form.setValue('status', 'CLOSED')}>
                          Cancel
                        </Button>
                        <Button type="submit" variant="destructive" className="flex-1" disabled={isPending || !form.watch('reason')}>
                          Confirm Reopen
                        </Button>
                      </div>
                    )}
                  </form>
                </Form>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
