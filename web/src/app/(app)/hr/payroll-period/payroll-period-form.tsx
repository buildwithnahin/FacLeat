'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { payrollPeriodFormSchema, PayrollPeriodFormValues } from '@/server/validators/payroll-periods';
import { createPayrollPeriod, updatePayrollPeriod } from '@/server/actions/payroll-periods';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i);

interface PayrollPeriodInitial {
  id: string;
  name: string;
  code: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  processingDate?: string | null;
  paymentDate?: string | null;
  attendanceCutoffDate?: string | null;
  overtimeCutoffDate?: string | null;
  leaveCutoffDate?: string | null;
  includeAttendance?: boolean;
  includeLeave?: boolean;
  includeOvertime?: boolean;
  includeBonus?: boolean;
  includeLoanDeduction?: boolean;
  includeSalaryAdvance?: boolean;
  includeTax?: boolean;
  allowReprocessing?: boolean;
  autoCloseAfterPayroll?: boolean;
  lockPayrollAfterClosing?: boolean;
  status?: string;
}

export function PayrollPeriodForm({
  mode,
  initial,
  path,
}: {
  mode: 'create' | 'edit';
  initial: PayrollPeriodInitial | null;
  path: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<PayrollPeriodFormValues>({
    resolver: zodResolver(payrollPeriodFormSchema),
    defaultValues: {
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      month: initial?.month ?? new Date().getMonth() + 1,
      year: initial?.year ?? new Date().getFullYear(),

      startDate: initial?.startDate ? new Date(initial.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: initial?.endDate ? new Date(initial.endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      processingDate: initial?.processingDate ? new Date(initial.processingDate) : undefined,
      paymentDate: initial?.paymentDate ? new Date(initial.paymentDate) : undefined,

      attendanceCutoffDate: initial?.attendanceCutoffDate ? new Date(initial.attendanceCutoffDate) : undefined,
      overtimeCutoffDate: initial?.overtimeCutoffDate ? new Date(initial.overtimeCutoffDate) : undefined,
      leaveCutoffDate: initial?.leaveCutoffDate ? new Date(initial.leaveCutoffDate) : undefined,

      includeAttendance: initial?.includeAttendance ?? true,
      includeLeave: initial?.includeLeave ?? true,
      includeOvertime: initial?.includeOvertime ?? true,
      includeBonus: initial?.includeBonus ?? true,
      includeLoanDeduction: initial?.includeLoanDeduction ?? true,
      includeSalaryAdvance: initial?.includeSalaryAdvance ?? true,
      includeTax: initial?.includeTax ?? true,

      allowReprocessing: initial?.allowReprocessing ?? false,
      autoCloseAfterPayroll: initial?.autoCloseAfterPayroll ?? true,
      lockPayrollAfterClosing: initial?.lockPayrollAfterClosing ?? true,

      status: (initial?.status as PayrollPeriodFormValues['status']) ?? 'DRAFT',
    },
  });

  // Auto-fill name based on month and year
  const watchMonth = form.watch('month');
  const watchYear = form.watch('year');
  const watchName = form.watch('name');

  if (mode === 'create') {
    const expectedName = `${MONTHS.find((m) => m.value === watchMonth)?.label} ${watchYear}`;
    if (watchName !== expectedName && !form.formState.dirtyFields.name) {
      form.setValue('name', expectedName);
    }
  }

  function onSubmit(data: PayrollPeriodFormValues) {
    startTransition(async () => {
      const res = mode === 'create' ? await createPayrollPeriod(data) : await updatePayrollPeriod(initial!.id, data);

      if (res.success) {
        toast.success(mode === 'create' ? 'Payroll period created' : 'Payroll period updated');
        router.push(path);
      } else {
        toast.error(res.error || 'Failed to save payroll period');
      }
    });
  }

  return (
    <Card className="mt-6 border-primary/20 shadow-md">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50">
        <CardTitle>{mode === 'create' ? 'Create Payroll Period' : 'Edit Payroll Period'}</CardTitle>
        <CardDescription>Configure the payroll cycle and integration rules.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Section 1 - Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">1. Basic Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payroll Month *</FormLabel>
                      <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Month" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m.value} value={m.value.toString()}>
                              {m.label}
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
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year *</FormLabel>
                      <Select onValueChange={(val) => field.onChange(Number(val))} defaultValue={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {YEARS.map((y) => (
                            <SelectItem key={y} value={y.toString()}>
                              {y}
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. July 2026" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Code *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. PP001"
                          className="uppercase"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 2 - Date Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">2. Payroll Dates</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Start Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period End Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="processingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Processing Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salary Payment Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 3 - Attendance Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">3. Cut-off Dates</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="attendanceCutoffDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attendance Cut-off</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="overtimeCutoffDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overtime Cut-off</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="leaveCutoffDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Cut-off</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 4 - Payroll Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">4. Inclusion Rules</h3>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                {(
                  [
                    { name: 'includeAttendance', label: 'Attendance' },
                    { name: 'includeLeave', label: 'Leave' },
                    { name: 'includeOvertime', label: 'Overtime' },
                    { name: 'includeBonus', label: 'Bonus' },
                    { name: 'includeLoanDeduction', label: 'Loans' },
                    { name: 'includeSalaryAdvance', label: 'Advances' },
                    { name: 'includeTax', label: 'Tax' },
                  ] as const
                ).map((setting) => (
                  <FormField
                    key={setting.name}
                    control={form.control}
                    name={setting.name}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal text-sm">{setting.label}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Section 5 - Lock Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">5. Lock Configuration</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="allowReprocessing"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Allow Reprocessing</FormLabel>
                        <FormDescription>Can rerun payroll if not closed</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="autoCloseAfterPayroll"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Auto Close</FormLabel>
                        <FormDescription>Close period automatically</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lockPayrollAfterClosing"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Lock After Close</FormLabel>
                        <FormDescription>Prevents historical edits</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => router.push(path)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  form.setValue('status', 'DRAFT');
                  form.handleSubmit(onSubmit)();
                }}
                disabled={isPending}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                onClick={() => {
                  form.setValue('status', 'OPEN');
                  form.handleSubmit(onSubmit)();
                }}
                disabled={isPending}
              >
                Save & Open Period
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
