'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { payrollAdjustmentFormSchema, PayrollAdjustmentFormValues } from '@/server/validators/payroll-adjustment';
import { createPayrollAdjustment, updatePayrollAdjustment } from '@/server/actions/payroll-adjustments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface PayrollAdjustmentFormProps {
  employees: any[];
  payrollPeriods: any[];
  initialData?: any;
  mode?: 'create' | 'edit';
  onClose?: () => void;
  path?: string;
}

export function PayrollAdjustmentForm({
  employees,
  payrollPeriods,
  initialData,
  mode = 'create',
  onClose,
  path = '/hr/payroll-adjustment'
}: PayrollAdjustmentFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PayrollAdjustmentFormValues>({
    resolver: zodResolver(payrollAdjustmentFormSchema),
    defaultValues: {
      payrollPeriodId: initialData?.payrollPeriodId || '',
      adjustmentDate: initialData?.adjustmentDate ? new Date(initialData.adjustmentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      type: initialData?.type || 'ALLOWANCE',
      category: initialData?.category || 'ONE_TIME',
      amount: initialData?.amount ? Number(initialData.amount) : undefined,
      description: initialData?.description || '',
      includeInGrossSalary: initialData?.includeInGrossSalary ?? true,
      includeInTax: initialData?.includeInTax ?? false,
      includeInPayslip: initialData?.includeInPayslip ?? true,
      reason: initialData?.reason || 'OTHER',
      remarks: initialData?.remarks || '',
      employeeIds: initialData?.employeeId ? [initialData.employeeId] : [],
    },
  });

  const selectedEmployeeIds = form.watch('employeeIds') || [];

  const onSubmit = async (data: PayrollAdjustmentFormValues) => {
    setIsSubmitting(true);
    try {
      const result =
        mode === 'create'
          ? await createPayrollAdjustment(data)
          : await updatePayrollAdjustment(initialData.id, data);

      if (result.success) {
        toast.success(`Payroll Adjustment ${mode === 'create' ? 'created' : 'updated'} successfully`);
        if (onClose) onClose();
        router.push(path);
      } else {
        toast.error(result.error || 'Failed to save adjustment');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Select the payroll period and employees</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="payrollPeriodId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payroll Period *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={mode === 'edit'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Open Payroll Period" />
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
                  name="adjustmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adjustment Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="employeeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employees *</FormLabel>
                      <FormControl>
                        <div className="border rounded-md max-h-[250px] overflow-y-auto p-4 space-y-2 bg-slate-50 dark:bg-slate-900/40">
                          {employees.map((emp) => (
                            <div key={emp.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`emp-${emp.id}`}
                                checked={field.value?.includes(emp.id)}
                                disabled={mode === 'edit'}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), emp.id])
                                    : field.onChange(field.value?.filter((value) => value !== emp.id));
                                }}
                              />
                              <label
                                htmlFor={`emp-${emp.id}`}
                                className="text-sm font-medium leading-none cursor-pointer"
                              >
                                {emp.firstName} {emp.lastName} ({emp.code})
                              </label>
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormDescription>
                        {mode === 'create'
                          ? `You can select multiple employees to apply this adjustment in bulk. Selected: ${selectedEmployeeIds.length}`
                          : 'Employee selection cannot be changed during editing.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Adjustment Details</CardTitle>
                <CardDescription>Configure the amount and reason</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adjustment Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ALLOWANCE">Allowance (Addition)</SelectItem>
                            <SelectItem value="DEDUCTION">Deduction (Subtraction)</SelectItem>
                            <SelectItem value="BONUS_CORRECTION">Bonus Correction</SelectItem>
                            <SelectItem value="SALARY_CORRECTION">Salary Correction</SelectItem>
                            <SelectItem value="TAX_ADJUSTMENT">Tax Adjustment</SelectItem>
                            <SelectItem value="OVERTIME_ADJUSTMENT">Overtime Adjustment</SelectItem>
                            <SelectItem value="ATTENDANCE_ADJUSTMENT">Attendance Adjustment</SelectItem>
                            <SelectItem value="LOAN_ADJUSTMENT">Loan Adjustment</SelectItem>
                            <SelectItem value="ADVANCE_ADJUSTMENT">Advance Adjustment</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ONE_TIME">One-Time (Normally)</SelectItem>
                            <SelectItem value="RECURRING">Recurring</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (৳) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0.01" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ATTENDANCE_CORRECTION">Attendance Correction</SelectItem>
                            <SelectItem value="MANUAL_BONUS">Manual Bonus</SelectItem>
                            <SelectItem value="LATE_SALARY_REVISION">Late Salary Revision</SelectItem>
                            <SelectItem value="OT_CORRECTION">OT Correction</SelectItem>
                            <SelectItem value="RECOVERY">Damage/Uniform Recovery</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description / Remarks</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Explain why this manual adjustment is needed..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payroll Impact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="includeInGrossSalary"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Include in Gross Salary Calculation</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="includeInPayslip"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Show separately in Payslip</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex gap-4 justify-end">
              <Button type="button" variant="outline" onClick={() => (onClose ? onClose() : router.push(path))}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Adjustment' : 'Update Adjustment'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
