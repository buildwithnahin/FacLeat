'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { calculatePayrollSchema, CalculatePayrollFormValues } from '@/server/validators/payroll-run';
import { calculatePayrollAction } from '@/server/actions/payroll-run';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface PeriodOption {
  id: string;
  name: string;
  status: string;
}

export function CalculatePayrollForm({
  payrollPeriods,
  branches,
  onClose,
}: {
  payrollPeriods: PeriodOption[];
  branches: BranchOption[];
  onClose?: () => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const form = useForm<CalculatePayrollFormValues>({
    resolver: zodResolver(calculatePayrollSchema),
    defaultValues: {
      payrollPeriodId: payrollPeriods[0]?.id || '',
      branchId: branches[0]?.id || '',
    },
  });

  const onSubmit = async (data: CalculatePayrollFormValues) => {
    setIsSubmitting(true);
    setStep(3); // Loading state visually

    try {
      const result = await calculatePayrollAction(data);

      if (result.success) {
        toast.success(`Payroll calculated successfully`);
        if (onClose) onClose();
        router.push(`/hr/payroll-run/${result.data.id}`);
      } else {
        toast.error(result.error || 'Failed to calculate payroll');
        setStep(1);
      }
    } catch {
      toast.error('An unexpected error occurred');
      setStep(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto border-0 shadow-none">
      <CardHeader>
        <CardTitle>Calculate Payroll</CardTitle>
        <CardDescription>{step === 1 ? 'Step 1: Select criteria' : 'Step 2: Processing data...'}</CardDescription>
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="payrollPeriodId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payroll Period *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Open Period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {payrollPeriods.map((pp) => (
                            <SelectItem key={pp.id} value={pp.id}>
                              {pp.name} ({pp.status})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Branch" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md text-sm border border-blue-200 dark:border-blue-800">
                <strong>Note:</strong> Generating payroll will automatically fetch and calculate Salary Structures, Active
                Loans, Approved Bonuses, and Payroll Adjustments.
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => (onClose ? onClose() : router.push('/hr/payroll-run'))}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  Fetch & Calculate
                </Button>
              </div>
            </form>
          </Form>
        )}

        {step === 3 && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            <h3 className="text-lg font-medium">Calculating Payroll...</h3>
            <div className="text-sm text-muted-foreground text-center max-w-md">
              <p>✔ Fetching active employees</p>
              <p>✔ Computing salary structures</p>
              <p>✔ Merging loans, bonuses, and adjustments</p>
              <p>✔ Validating numbers</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
