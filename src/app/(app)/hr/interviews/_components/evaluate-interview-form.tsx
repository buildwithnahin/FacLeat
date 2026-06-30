'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { evaluateInterviewAction, type ActionState } from '@/server/actions/hr-recruitment';

interface Props {
  interviewId: string;
  candidateName: string;
  interviewType: string;
  onSuccess?: () => void;
}

export function EvaluateInterviewForm({ interviewId, candidateName, interviewType, onSuccess }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    evaluateInterviewAction,
    undefined
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      if (formRef.current) formRef.current.reset();
      if (onSuccess) onSuccess();
    }
  }, [state, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="interviewId" value={interviewId} />
      
      <div className="bg-muted/30 p-3 rounded-lg border text-xs space-y-1 mb-2">
        <div>
          <span className="font-semibold text-muted-foreground">Evaluating:</span>{' '}
          <span className="font-bold text-foreground">{candidateName}</span>
        </div>
        <div>
          <span className="font-semibold text-muted-foreground">Round:</span>{' '}
          <span className="font-medium text-foreground">{interviewType}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="communication">Communication Score (1-10) *</Label>
          <Input
            id="communication"
            name="communication"
            type="number"
            min={1}
            max={10}
            defaultValue={5}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="technicalSkill">Technical Skill Score (1-10) *</Label>
          <Input
            id="technicalSkill"
            name="technicalSkill"
            type="number"
            min={1}
            max={10}
            defaultValue={5}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recommendation">Decision *</Label>
        <select
          id="recommendation"
          name="recommendation"
          defaultValue="Selected"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="Selected">Select / Pass Interview</option>
          <option value="Rejected">Reject Candidate</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="remarks">Interview Remarks & Feedback *</Label>
        <textarea
          id="remarks"
          name="remarks"
          rows={3}
          placeholder="Enter technical details, communication skills, and general comments..."
          required
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Saving Evaluation...' : 'Submit Evaluation'}
        </Button>
      </div>
      
      {state?.error && <p className="text-xs text-destructive mt-1">{state.error}</p>}
      {state?.success && (
        <p className="text-xs text-emerald-600 font-medium mt-1">
          Evaluation submitted successfully.
        </p>
      )}
    </form>
  );
}
