'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { bonusFormSchema, BonusFormValues } from '@/server/validators/bonus';
import { createBonus, updateBonus } from '@/server/actions/bonus';
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
import { formatCurrency } from '@/lib/utils';

type BonusFormEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
  basicSalary: number;
};

interface BonusFormProps {
  employees: BonusFormEmployee[];
  initialData?: any;
  mode?: 'create' | 'edit';
  onClose?: () => void;
  path?: string;
}

export function BonusForm({ employees, initialData, mode = 'create', onClose, path = '/hr/bonus' }: BonusFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BonusFormValues>({
    resolver: zodResolver(bonusFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      code: initialData?.code || `BON-${Date.now().toString().slice(-4)}`,
      bonusType: initialData?.bonusType || 'FESTIVAL',
      effectivePayrollMonth: initialData?.effectivePayrollMonth || new Date().toISOString().substring(0, 7),
      description: initialData?.description || '',
      calculationMethod: initialData?.calculationMethod || 'FIXED_AMOUNT',
      amount: initialData?.amount ? Number(initialData.amount) : undefined,
      percentage: initialData?.percentage ? Number(initialData.percentage) : undefined,
      basedOn: initialData?.basedOn || null,
      minimumServiceMonths: initialData?.minimumServiceMonths || 0,
      paymentMethod: initialData?.paymentMethod || 'PAYROLL',
      paymentDate: initialData?.paymentDate ? new Date(initialData.paymentDate).toISOString().split('T')[0] : null,
      includeInPayslip: initialData?.includeInPayslip ?? true,
      employeeIds: initialData?.employeeBonuses?.map((eb: any) => eb.employeeId) || [],
    },
  });

  const calculationMethod = form.watch('calculationMethod');
  const selectedEmployeeIds = form.watch('employeeIds');

  // Preview Calculation logic for form preview
  const amount = form.watch('amount');
  const percentage = form.watch('percentage');
  const basedOn = form.watch('basedOn');

  const selectedEmployees = employees.filter((e) => selectedEmployeeIds.includes(e.id));
  
  const totalCost = selectedEmployees.reduce((acc, emp) => {
    let empBonus = 0;
    if (calculationMethod === 'FIXED_AMOUNT') {
      empBonus = Number(amount || 0);
    } else if (calculationMethod === 'PERCENTAGE' && percentage) {
      let baseAmount = 0;
      if (basedOn === 'BASIC_SALARY') {
        baseAmount = Number(emp.basicSalary || 0);
      } else {
        baseAmount = Number(emp.basicSalary || 0); // Simplified for UI preview
      }
      empBonus = (baseAmount * Number(percentage)) / 100;
    }
    return acc + empBonus;
  }, 0);

  const onSubmit = async (data: BonusFormValues) => {
    setIsSubmitting(true);
    try {
      const result =
        mode === 'create'
          ? await createBonus(data)
          : await updateBonus(initialData.id, data);

      if (result.success) {
        toast.success(`Bonus ${mode === 'create' ? 'created' : 'updated'} successfully`);
        if (onClose) onClose();
        router.push(path);
      } else {
        toast.error(result.error || 'Failed to save bonus');
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
                <CardDescription>Setup the core details of this bonus</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bonus Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Eid-ul-Fitr Bonus" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bonus Code *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bonusType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bonus Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="FESTIVAL">Festival Bonus</SelectItem>
                            <SelectItem value="ATTENDANCE">Attendance Bonus</SelectItem>
                            <SelectItem value="PRODUCTION">Production Bonus</SelectItem>
                            <SelectItem value="PERFORMANCE">Performance Bonus</SelectItem>
                            <SelectItem value="SALES_INCENTIVE">Sales Incentive</SelectItem>
                            <SelectItem value="SPECIAL">Special Bonus</SelectItem>
                            <SelectItem value="YEARLY">Yearly Bonus</SelectItem>
                            <SelectItem value="JOINING">Joining Bonus</SelectItem>
                            <SelectItem value="RETENTION">Retention Bonus</SelectItem>
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
                  name="effectivePayrollMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective Payroll Month *</FormLabel>
                      <FormControl>
                        <Input type="month" {...field} />
                      </FormControl>
                      <FormDescription>The payroll month this bonus applies to (YYYY-MM)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Optional details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Calculation & Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="calculationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calculation Method *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                          <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                          <SelectItem value="FORMULA">Formula</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {calculationMethod === 'FIXED_AMOUNT' && (
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fixed Amount *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {calculationMethod === 'PERCENTAGE' && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="percentage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Percentage (%) *</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="basedOn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Based On *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select base" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="BASIC_SALARY">Basic Salary</SelectItem>
                              <SelectItem value="GROSS_SALARY">Gross Salary</SelectItem>
                              <SelectItem value="NET_SALARY">Net Salary</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PAYROLL">Payroll</SelectItem>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="includeInPayslip"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Include in Payslip</FormLabel>
                        <FormDescription>
                          If checked, this bonus will appear on the employee's standard monthly payslip.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Eligible Employees</CardTitle>
                <CardDescription>Select the employees who will receive this bonus</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="employeeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employees *</FormLabel>
                      <FormControl>
                        <div className="border rounded-md max-h-[300px] overflow-y-auto p-4 space-y-2">
                          {employees.map((emp) => (
                            <div key={emp.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`emp-${emp.id}`}
                                checked={field.value?.includes(emp.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, emp.id])
                                    : field.onChange(field.value?.filter((value) => value !== emp.id));
                                }}
                              />
                              <label
                                htmlFor={`emp-${emp.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {emp.firstName} {emp.lastName} ({emp.code})
                              </label>
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="p-4 rounded-md border bg-slate-50 dark:bg-slate-900/40 text-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground">Selected Employees:</span>
                    <span className="font-semibold">{selectedEmployeeIds.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Estimated Total Cost:</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(totalCost)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conditions (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="minimumServiceMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Service (Months)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormDescription>Only employees with this much tenure will be eligible.</FormDescription>
                      <FormMessage />
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
                {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Bonus' : 'Update Bonus'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
