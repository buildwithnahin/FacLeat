'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { calculateSettlementSchema } from '@/server/validators/final-settlement';
import { calculateSettlementAction } from '@/server/actions/final-settlements';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function CalculateForm({
  resignations,
  onClose,
}: {
  resignations: any[];
  onClose?: () => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<{ resignationId: string }>({
    resolver: zodResolver(calculateSettlementSchema),
    defaultValues: {
      resignationId: resignations[0]?.id || '',
    },
  });

  const onSubmit = async (data: { resignationId: string }) => {
    setIsSubmitting(true);
    try {
      const result = await calculateSettlementAction(data);

      if (result.success) {
        toast.success(`Final Settlement calculated successfully`);
        router.push(`/hr/final-settlement/${result.data.id}`);
      } else {
        toast.error(result.error || 'Failed to calculate settlement');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (resignations.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto border-0 shadow-none">
        <CardHeader className="text-center pb-8 pt-12">
          <CardTitle>No Eligible Employees</CardTitle>
          <CardDescription>
            There are no employees who have an approved separation AND a completed Exit Clearance.
            <br/><br/>
            Note: Final Settlement can only be processed for employees who have completely finished the exit clearance process.
          </CardDescription>
          <div className="mt-8">
            <Button variant="outline" onClick={() => (onClose ? onClose() : router.push('/hr/final-settlement'))}>
              Back to Dashboard
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto border-0 shadow-none">
      <CardHeader>
        <CardTitle>Create Final Settlement</CardTitle>
        <CardDescription>Select an eligible employee from the separation queue to calculate their settlement.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-md text-sm border border-blue-200 dark:border-blue-800 mb-6">
              <strong>Settlement Checklist automatically verified:</strong>
              <ul className="mt-2 space-y-1 ml-4 list-disc">
                <li>Separation Approved</li>
                <li>Exit Clearance Completed</li>
                <li>Company Assets Returned</li>
              </ul>
            </div>

            <FormField
              control={form.control}
              name="resignationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Eligible Employee *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Employee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {resignations.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.employee.firstName} {r.employee.lastName} ({r.employee.code}) - {r.resignationType.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => (onClose ? onClose() : router.push('/hr/final-settlement'))}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Calculating...' : 'Calculate Settlement'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
