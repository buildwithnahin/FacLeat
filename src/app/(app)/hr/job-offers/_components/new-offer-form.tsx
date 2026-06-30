'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createJobOfferAction, type ActionState } from '@/server/actions/hr-recruitment';

interface Props {
  selectedCandidates: Array<{
    id: string;
    title: string;
    subject: string;
    metadata: any;
  }>;
}

export function NewOfferForm({ selectedCandidates }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createJobOfferAction,
    undefined
  );

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
          <Label htmlFor="candidateId">Select Selected Candidate *</Label>
          <select
            id="candidateId"
            name="candidateId"
            required
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Select candidate...</option>
            {selectedCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.subject})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="salary">Offered Salary (BDT Monthly) *</Label>
          <Input
            id="salary"
            name="salary"
            type="number"
            min={0}
            placeholder="e.g. 52000"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="joiningDate">Expected Joining Date *</Label>
          <Input id="joiningDate" name="joiningDate" type="date" required />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expiryDate">Offer Letter Expiry Date *</Label>
          <Input id="expiryDate" name="expiryDate" type="date" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Offer Remarks / Special Allowances</Label>
          <Input
            id="notes"
            name="notes"
            placeholder="e.g. 3-month probation, festival bonus eligibility"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Generating Offer...' : 'Create & Send Job Offer'}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-emerald-600 font-medium">
            Job offer generated and candidate notified.
          </p>
        )}
      </div>
    </form>
  );
}
