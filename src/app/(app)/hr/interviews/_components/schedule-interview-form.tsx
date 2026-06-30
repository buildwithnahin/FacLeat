'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { scheduleInterviewAction, type ActionState } from '@/server/actions/hr-recruitment';

interface Props {
  shortlistedCandidates: Array<{
    id: string;
    title: string;
    subject: string;
    metadata: any;
  }>;
}

export function ScheduleInterviewForm({ shortlistedCandidates }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    scheduleInterviewAction,
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="candidateId">Select Candidate *</Label>
          <select
            id="candidateId"
            name="candidateId"
            required
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Choose candidate...</option>
            {shortlistedCandidates.map((c) => {
              const meta = c.metadata || {};
              return (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.subject})
                </option>
              );
            })}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="interviewDate">Interview Date & Time *</Label>
          <Input
            id="interviewDate"
            name="interviewDate"
            type="datetime-local"
            required
            className="min-w-0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="interviewType">Interview Type *</Label>
          <select
            id="interviewType"
            name="interviewType"
            defaultValue="Technical"
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="Technical">Technical Interview</option>
            <option value="HR">HR Interview</option>
            <option value="Managerial">Managerial Round</option>
            <option value="Final Board">Final Board Interview</option>
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="panel">Interview Panel Members *</Label>
          <Input
            id="panel"
            name="panel"
            placeholder="e.g. HR Manager, Tech Lead"
            required
            className="min-w-0"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Scheduling...' : 'Schedule Interview'}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-emerald-600 font-medium">
            Interview scheduled successfully.
          </p>
        )}
      </div>
    </form>
  );
}
