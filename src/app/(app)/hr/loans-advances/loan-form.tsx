'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { loanFormSchema, LoanFormValues } from '@/server/validators/loans';
import { createLoanAction, updateLoanAction } from '@/server/actions/loans';
import { LoanType, LoanPurpose, LoanInstallmentType } from '@prisma/client';

type LoanFormEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
  basicSalary: number;
};

export function LoanForm({
  mode,
  initial,
  employees,
  path,
}: {
  mode: 'create' | 'edit';
  initial: any | null;
  employees: LoanFormEmployee[];
  path: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      requestType: initial?.requestType ?? 'EMPLOYEE_LOAN',
      employeeId: initial?.employeeId ?? '',
      loanAmount: initial?.loanAmount != null ? Number(initial.loanAmount) : undefined,
      purpose: initial?.purpose ?? 'OTHERS',
      disbursementDate: initial?.disbursementDate ? new Date(initial.disbursementDate) : new Date(),
      repaymentStartMonth: initial?.repaymentStartMonth ?? format(new Date(), 'yyyy-MM'),
      installmentType: initial?.installmentType ?? 'MONTHLY',
      numberOfInstallments: initial?.numberOfInstallments ?? undefined,
      monthlyDeduction: initial?.monthlyDeduction != null ? Number(initial.monthlyDeduction) : undefined,
      remarks: initial?.remarks ?? '',
      status: initial?.status ?? 'DRAFT',
    },
  });

  const watchRequestType = form.watch('requestType');
  const watchEmployeeId = form.watch('employeeId');
  const watchLoanAmount = form.watch('loanAmount');
  const watchInstallments = form.watch('numberOfInstallments');
  const watchMonthlyDeduction = form.watch('monthlyDeduction');
  const deductionOverriddenRef = useRef(mode === 'edit');

  const selectedEmployee = employees.find(e => e.id === watchEmployeeId);

  useEffect(() => {
    if (watchLoanAmount > 0 && watchInstallments > 0 && !deductionOverriddenRef.current) {
      const calculated = Number((watchLoanAmount / watchInstallments).toFixed(2));
      if (Math.abs((watchMonthlyDeduction || 0) - calculated) > 0.01) {
        form.setValue('monthlyDeduction', calculated, { shouldDirty: false });
      }
    }
  }, [form, watchInstallments, watchLoanAmount, watchMonthlyDeduction]);

  function onSubmit(data: LoanFormValues) {
    startTransition(async () => {
      const res = mode === 'create' 
        ? await createLoanAction(data)
        : await updateLoanAction(initial!.id, data);

      if (res.success) {
        toast.success(mode === 'create' ? 'Request created successfully' : 'Request updated successfully');
        router.push(path);
      } else {
        toast.error(res.error || 'Failed to save request');
      }
    });
  }

  return (
    <Card className="mt-6 border-primary/20 shadow-md">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50">
        <CardTitle>{mode === 'create' ? 'Create Request' : 'Edit Request'}</CardTitle>
        <CardDescription>Request for Employee Loan or Salary Advance.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Section 1 - Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">1. Request Details</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="requestType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Type *</FormLabel>
                      <Select onValueChange={(val) => {
                        field.onChange(val);
                        if (val === 'SALARY_ADVANCE') {
                          form.setValue('numberOfInstallments', 1);
                          form.setValue('installmentType', 'ONE_TIME');
                          deductionOverriddenRef.current = false;
                        }
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="EMPLOYEE_LOAN">Employee Loan</SelectItem>
                          <SelectItem value="SALARY_ADVANCE">Salary Advance</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Employee *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an employee..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName} ({emp.code}) - {emp.basicSalary ? `Basic: ৳${emp.basicSalary}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {selectedEmployee && (
                <div className="p-4 rounded-md border bg-slate-50 dark:bg-slate-900/40 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground block mb-1">Current Basic Salary</span>
                      <span className="font-semibold text-emerald-600">৳ {selectedEmployee.basicSalary || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Validation Note</span>
                      <span className="text-orange-600 dark:text-orange-400">Ensure deduction respects company policy.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2 - Loan Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">2. Financials</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <FormField control={form.control} name="loanAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Requested *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => {
                      deductionOverriddenRef.current = false;
                      field.onChange(e.target.value === '' ? undefined : Number(e.target.value));
                    }} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="purpose" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.keys(LoanPurpose).map(p => (
                          <SelectItem key={p} value={p}>{p.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="disbursementDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Disbursement Date *</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(new Date(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Section 3 - Repayment */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">3. Repayment Schedule</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <FormField control={form.control} name="repaymentStartMonth" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repayment Start (YYYY-MM) *</FormLabel>
                    <FormControl><Input placeholder="e.g. 2026-07" {...field} /></FormControl>
                    <FormDescription>The payroll run that deducts the first installment.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="installmentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Installment Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={watchRequestType === 'SALARY_ADVANCE'}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="ONE_TIME">One Time</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="numberOfInstallments" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Installments *</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} value={field.value ?? ''} onChange={e => {
                      deductionOverriddenRef.current = false;
                      field.onChange(e.target.value === '' ? undefined : Number(e.target.value));
                    }} disabled={watchRequestType === 'SALARY_ADVANCE'} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="monthlyDeduction" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Deduction *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => {
                      deductionOverriddenRef.current = true;
                      field.onChange(e.target.value === '' ? undefined : Number(e.target.value));
                    }} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {watchLoanAmount > 0 && watchInstallments > 0 && (
                <div className="mt-4 p-4 rounded-md border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-sm">
                  <span className="font-semibold text-blue-700 dark:text-blue-300">Repayment Plan:</span> 
                  Deducting ৳{form.getValues('monthlyDeduction')} per month for {watchInstallments} month(s) starting from {form.getValues('repaymentStartMonth')}.
                </div>
              )}
            </div>
            
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks</FormLabel>
                <FormControl><Textarea placeholder="Additional notes..." {...field} value={field.value || ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => router.push(path)}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" onClick={() => {
                form.setValue('status', 'DRAFT');
                form.handleSubmit(onSubmit)();
              }} disabled={isPending}>
                Save Draft
              </Button>
              <Button type="button" onClick={() => {
                form.setValue('status', 'SUBMITTED');
                form.handleSubmit(onSubmit)();
              }} disabled={isPending}>
                Submit Request
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
