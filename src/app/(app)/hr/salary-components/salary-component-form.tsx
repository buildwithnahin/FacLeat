'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { salaryComponentFormSchema, SalaryComponentFormValues } from '@/server/validators/salary-components';
import { createSalaryComponent, updateSalaryComponent } from '@/server/actions/salary-components';

type SalaryComponentFormInitial = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category: string;
  type: string;
  calculationType: string;
  value: number | null;
  formula: string | null;
  baseComponent: string | null;
  isTaxable: boolean;
  includeInGross: boolean;
  includeInNet: boolean;
  showInPayslip: boolean;
  isSystemGenerated: boolean;
  isMandatory: boolean;
  isEditableDuringPayroll: boolean;
  allowNegativeValue: boolean;
  maxAmount: number | null;
  minAmount: number | null;
  status: string;
  applicableEmploymentTypes: string[];
  applicableDepartments: string[];
  applicableDesignations: string[];
};

export function SalaryComponentForm({
  mode,
  initial,
  departments,
  designations,
  employmentTypes,
  components,
  path,
}: {
  mode: 'create' | 'edit';
  initial: SalaryComponentFormInitial | null;
  departments: string[];
  designations: string[];
  employmentTypes: string[];
  components: SalaryComponentFormInitial[];
  path: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<SalaryComponentFormValues>({
    resolver: zodResolver(salaryComponentFormSchema),
    defaultValues: {
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      description: initial?.description ?? '',
      category: initial?.category ?? 'EARNINGS',
      type: initial?.type ?? 'FIXED',
      calculationType: initial?.calculationType ?? 'FIXED_AMOUNT',
      value: initial?.value ? Number(initial.value) : undefined,
      formula: initial?.formula ?? '',
      baseComponent: initial?.baseComponent ?? '',
      isTaxable: initial?.isTaxable ?? true,
      includeInGross: initial?.includeInGross ?? true,
      includeInNet: initial?.includeInNet ?? true,
      showInPayslip: initial?.showInPayslip ?? true,
      isSystemGenerated: initial?.isSystemGenerated ?? false,
      isMandatory: initial?.isMandatory ?? false,
      isEditableDuringPayroll: initial?.isEditableDuringPayroll ?? false,
      allowNegativeValue: initial?.allowNegativeValue ?? false,
      maxAmount: initial?.maxAmount ? Number(initial.maxAmount) : undefined,
      minAmount: initial?.minAmount ? Number(initial.minAmount) : undefined,
      status: initial?.status ?? 'ACTIVE',
      applicableEmploymentTypes: initial?.applicableEmploymentTypes ?? [],
      applicableDepartments: initial?.applicableDepartments ?? [],
      applicableDesignations: initial?.applicableDesignations ?? [],
    },
  });

  const watchCalculationType = form.watch('calculationType');

  function onSubmit(data: SalaryComponentFormValues) {
    startTransition(async () => {
      const res = mode === 'create' 
        ? await createSalaryComponent(data)
        : await updateSalaryComponent(initial!.id, data);

      if (res.success) {
        toast.success(mode === 'create' ? 'Component created' : 'Component updated');
        router.push(path);
      } else {
        toast.error(res.error || 'Failed to save salary component');
      }
    });
  }

  return (
    <Card className="mt-6 border-primary/20 shadow-md">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50">
        <CardTitle>{mode === 'create' ? 'Create Salary Component' : 'Edit Salary Component'}</CardTitle>
        <CardDescription>Configure calculation rules, taxability, and applicability.</CardDescription>
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Component Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Basic Salary, House Rent" {...field} />
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
                      <FormLabel>Component Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. BASIC, HRA" {...field} className="uppercase" onChange={e => field.onChange(e.target.value.toUpperCase())} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Brief description of the component" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 2 - Category */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">2. Component Category</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="EARNINGS">Earnings</SelectItem>
                          <SelectItem value="DEDUCTION">Deduction</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FIXED">Fixed</SelectItem>
                          <SelectItem value="VARIABLE">Variable</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Section 3 - Calculation Method */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">3. Calculation Method</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="calculationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calculation Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                          <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                          <SelectItem value="FORMULA">Formula</SelectItem>
                          <SelectItem value="MANUAL_ENTRY">Manual Entry</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {watchCalculationType === 'FIXED_AMOUNT' && (
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Value</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {watchCalculationType === 'PERCENTAGE' && (
                  <>
                    <FormField
                      control={form.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Percentage (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" max="100" min="0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="baseComponent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Percentage Of</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Base" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="BASIC">Basic Salary</SelectItem>
                              <SelectItem value="GROSS">Gross Salary</SelectItem>
                              <SelectItem value="NET">Net Salary</SelectItem>
                              {components.filter(c => c.code !== form.getValues('code')).map(c => (
                                <SelectItem key={c.id} value={c.code}>{c.name} ({c.code})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                
                {watchCalculationType === 'FORMULA' && (
                  <FormField
                    control={form.control}
                    name="formula"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Formula Builder</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g. BASIC * 0.4 + 1000" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormDescription>
                          Use valid component codes (e.g. BASIC, GROSS) and standard math operators (+, -, *, /).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* Section 4 - Payroll Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">4. Payroll Settings</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <FormField control={form.control} name="includeInGross" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel>Include in Gross</FormLabel></div>
                  </FormItem>
                )} />
                <FormField control={form.control} name="includeInNet" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel>Include in Net</FormLabel></div>
                  </FormItem>
                )} />
                <FormField control={form.control} name="isTaxable" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel>Taxable</FormLabel></div>
                  </FormItem>
                )} />
                <FormField control={form.control} name="showInPayslip" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel>Show in Payslip</FormLabel></div>
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Section 6 - Validation Rules */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">6. Validation Rules</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField control={form.control} name="isMandatory" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel>Mandatory</FormLabel></div>
                  </FormItem>
                )} />
                <FormField control={form.control} name="isEditableDuringPayroll" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel>Editable During Payroll</FormLabel></div>
                  </FormItem>
                )} />
                <FormField control={form.control} name="allowNegativeValue" render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel>Allow Negative Value</FormLabel></div>
                  </FormItem>
                )} />
                <FormField control={form.control} name="minAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Amount</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="maxAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Amount</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => router.push(path)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Component'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
