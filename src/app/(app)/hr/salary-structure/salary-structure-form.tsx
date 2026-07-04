'use client';

import { useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SalaryComponent, SalaryStructureStatus, PayrollFrequency, SalaryStructure } from '@prisma/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { salaryStructureFormSchema, SalaryStructureFormValues } from '@/server/validators/salary-structures';
import { createSalaryStructure, updateSalaryStructure } from '@/server/actions/salary-structures';
import { Trash } from 'lucide-react';

export function SalaryStructureForm({
  mode,
  initial,
  departments,
  designations,
  employmentTypes,
  branches,
  salaryComponents,
  path,
}: {
  mode: 'create' | 'edit';
  initial: any | null;
  departments: string[];
  designations: string[];
  employmentTypes: string[];
  branches: { id: string, name: string, code: string }[];
  salaryComponents: SalaryComponent[];
  path: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<SalaryStructureFormValues>({
    resolver: zodResolver(salaryStructureFormSchema),
    defaultValues: {
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      description: initial?.description ?? '',
      status: initial?.status ?? 'ACTIVE',
      grossSalary: initial?.grossSalary ? Number(initial.grossSalary) : 0,
      netSalary: initial?.netSalary ? Number(initial.netSalary) : undefined,
      effectiveFrom: initial?.effectiveFrom ? new Date(initial.effectiveFrom) : new Date(),
      effectiveTo: initial?.effectiveTo ? new Date(initial.effectiveTo) : undefined,
      payrollFrequency: initial?.payrollFrequency ?? 'MONTHLY',
      currency: initial?.currency ?? 'BDT',
      employmentTypes: initial?.employmentTypes ?? [],
      departmentIds: initial?.departmentIds ?? [],
      designationIds: initial?.designationIds ?? [],
      branchIds: initial?.branchIds ?? [],
      notes: initial?.notes ?? '',
      components: initial?.components?.map((c: any) => ({
        salaryComponentId: c.salaryComponentId,
        value: Number(c.value),
        isAutoCalculated: c.isAutoCalculated,
      })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'components',
  });

  const watchComponents = form.watch('components');

  const { grossSalary, totalEarnings, totalFixedDeductions } = useMemo(() => {
    let earnings = 0;
    let deductions = 0;

    watchComponents.forEach(comp => {
      const componentDef = salaryComponents.find(sc => sc.id === comp.salaryComponentId);
      if (componentDef) {
        if (componentDef.category === 'EARNINGS') {
          earnings += Number(comp.value) || 0;
        } else if (componentDef.category === 'DEDUCTION' && componentDef.type === 'FIXED') {
          deductions += Number(comp.value) || 0;
        }
      }
    });

    return { 
      grossSalary: earnings,
      totalEarnings: earnings,
      totalFixedDeductions: deductions,
    };
  }, [watchComponents, salaryComponents]);

  // Update gross salary automatically
  if (form.getValues('grossSalary') !== grossSalary) {
    form.setValue('grossSalary', grossSalary);
  }

  function onSubmit(data: SalaryStructureFormValues) {
    startTransition(async () => {
      const res = mode === 'create' 
        ? await createSalaryStructure(data)
        : await updateSalaryStructure(initial!.id, data);

      if (res.success) {
        toast.success(mode === 'create' ? 'Salary Structure created' : 'Salary Structure updated');
        router.push(path);
      } else {
        toast.error(res.error || 'Failed to save salary structure');
      }
    });
  }

  const unselectedComponents = salaryComponents.filter(
    sc => !fields.some(f => f.salaryComponentId === sc.id)
  );

  return (
    <Card className="mt-6 border-primary/20 shadow-md">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50">
        <CardTitle>{mode === 'create' ? 'Create Salary Structure' : 'Edit Salary Structure'}</CardTitle>
        <CardDescription>Combine components into a structured salary template.</CardDescription>
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
                      <FormLabel>Structure Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Factory Worker, Manager" {...field} />
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
                      <FormLabel>Structure Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. FW001" {...field} className="uppercase" onChange={e => field.onChange(e.target.value.toUpperCase())} />
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
                        <Textarea placeholder="Brief description of the structure" {...field} value={field.value || ''} />
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

            {/* Section 3 & 4 - Components */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">2. Salary Components</h3>
              
              {fields.length > 0 ? (
                <div className="space-y-3">
                  {fields.map((field, index) => {
                    const compDef = salaryComponents.find(sc => sc.id === field.salaryComponentId);
                    if (!compDef) return null;

                    return (
                      <div key={field.id} className="flex items-center gap-4 p-3 border rounded-md bg-slate-50 dark:bg-slate-900/40">
                        <div className="w-1/3">
                          <div className="font-medium">{compDef.name} ({compDef.code})</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <span className={compDef.category === 'EARNINGS' ? 'text-emerald-600' : 'text-red-600'}>
                              {compDef.category}
                            </span>
                            <span>•</span>
                            <span>{compDef.calculationType.replace('_', ' ')}</span>
                          </div>
                        </div>

                        <div className="flex-1 flex gap-4 items-center">
                          <FormField
                            control={form.control}
                            name={`components.${index}.value`}
                            render={({ field }) => (
                              <FormItem className="flex-1 max-w-[200px] mb-0">
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">৳</span>
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      className="pl-7"
                                      placeholder="Value"
                                      {...field} 
                                      onChange={e => field.onChange(Number(e.target.value))} 
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`components.${index}.isAutoCalculated`}
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">Auto-Calculate in Run</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-md text-muted-foreground">
                  No components added yet. Add components to build the structure.
                </div>
              )}

              {unselectedComponents.length > 0 && (
                <div className="flex items-center gap-4 mt-4">
                  <Select onValueChange={(val) => {
                    const compDef = salaryComponents.find(c => c.id === val);
                    append({ 
                      salaryComponentId: val, 
                      value: compDef?.value ? Number(compDef.value) : 0, 
                      isAutoCalculated: compDef?.calculationType !== 'FIXED_AMOUNT'
                    });
                  }}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Add Component..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unselectedComponents.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Section 5 - Salary Summary */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">3. Salary Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-md border bg-emerald-50 dark:bg-emerald-950/20">
                  <div className="text-sm text-muted-foreground mb-1">Total Earnings</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">৳ {totalEarnings.toFixed(2)}</div>
                </div>
                <div className="p-4 rounded-md border bg-red-50 dark:bg-red-950/20">
                  <div className="text-sm text-muted-foreground mb-1">Total Fixed Deductions</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">৳ {totalFixedDeductions.toFixed(2)}</div>
                </div>
                <div className="p-4 rounded-md border bg-blue-50 dark:bg-blue-950/20">
                  <div className="text-sm text-muted-foreground mb-1">Estimated Net Salary</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">৳ {(totalEarnings - totalFixedDeductions).toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Section 6 - Payroll Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">4. Payroll Settings</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective From *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(new Date(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="effectiveTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective To (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payrollFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payroll Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="WEEKLY">Weekly</SelectItem>
                          <SelectItem value="DAILY">Daily</SelectItem>
                          <SelectItem value="HOURLY">Hourly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => router.push(path)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Structure'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
