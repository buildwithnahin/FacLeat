'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { salaryStructureAssignmentSchema, SalaryStructureAssignmentValues } from '@/server/validators/salary-structures';
import { assignSalaryStructureEmployees } from '@/server/actions/salary-structures';

interface AssignmentEmployee {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
}

export function SalaryStructureAssignmentForm({
  structureId,
  employees,
}: {
  structureId: string;
  employees: AssignmentEmployee[];
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<SalaryStructureAssignmentValues>({
    resolver: zodResolver(salaryStructureAssignmentSchema),
    defaultValues: {
      employeeIds: [],
      effectiveFrom: new Date(),
      effectiveTo: undefined,
    },
  });

  const employeeOptions = employees.map((emp) => ({
    label: `${emp.firstName} ${emp.lastName} (${emp.code})`,
    value: emp.id,
  }));

  function onSubmit(data: SalaryStructureAssignmentValues) {
    startTransition(async () => {
      const res = await assignSalaryStructureEmployees(structureId, data);

      if (res.success) {
        toast.success(`Successfully assigned to ${data.employeeIds.length} employees`);
        form.reset({
          employeeIds: [],
          effectiveFrom: new Date(),
          effectiveTo: undefined,
        });
      } else {
        toast.error(res.error || 'Failed to assign employees');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assign Employees</CardTitle>
        <CardDescription>Link employees to this salary structure.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employeeIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employees *</FormLabel>
                  <FormControl>
                    <MultiSelect options={employeeOptions} selected={field.value} onChange={field.onChange} placeholder="Select employees..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective From *</FormLabel>
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
                name="effectiveTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective To</FormLabel>
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

            <Button type="submit" className="w-full" disabled={isPending || form.watch('employeeIds').length === 0}>
              {isPending ? 'Assigning...' : 'Assign Structure'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
