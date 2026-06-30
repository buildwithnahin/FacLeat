'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createRecruitmentRequestAction, type ActionState } from '@/server/actions/hr-recruitment';

const FALLBACK_DEPARTMENTS = ['Production', 'HR', 'Accounts'];

export function NewRequestForm({ departments }: { departments: string[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createRecruitmentRequestAction,
    {}
  );
  const departmentOptions = Array.from(new Set((departments.length ? departments : FALLBACK_DEPARTMENTS).filter(Boolean)));

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success && formRef.current) {
      formRef.current.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="position">Position Title *</Label>
          <Input
            id="position"
            name="position"
            placeholder="e.g. Production Supervisor"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="department">Department *</Label>
          <select
            id="department"
            name="department"
            required
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {departmentOptions.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vacancies">Number of Vacancies *</Label>
          <Input
            id="vacancies"
            name="vacancies"
            type="number"
            min={1}
            defaultValue={1}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="salaryRange">Salary Range *</Label>
          <Input
            id="salaryRange"
            name="salaryRange"
            placeholder="e.g. 45,000–55,000"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expectedJoining">Expected Joining Date *</Label>
          <Input
            id="expectedJoining"
            name="expectedJoining"
            type="date"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            defaultValue="NORMAL"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason for Recruitment / Justification *</Label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          placeholder="e.g. Factory Expansion, Increased workload, Backfill"
          required
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Submitting Request...' : 'Submit Request'}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-emerald-600 font-medium">
            Recruitment request submitted successfully.
          </p>
        )}
      </div>
    </form>
  );
}
