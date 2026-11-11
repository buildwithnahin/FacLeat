'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { closePosSessionAction } from '@/server/actions/pos';

interface Props {
  sessionId: string;
}

export function CloseSessionForm({ sessionId }: Props) {
  const [state, action, pending] = useActionState(closePosSessionAction, undefined);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Are you sure you want to close this cash session? This action cannot be undone.')) {
          e.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      {state?.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-1.5 text-xs text-destructive">
          {state.error}
        </div>
      )}
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground block font-medium">Counted cash (৳)</label>
          <Input
            name="countedCash"
            type="number"
            min={0}
            step="any"
            placeholder="0.00"
            className="w-40"
            required
          />
          {state?.fieldErrors?.countedCash && (
            <p className="text-xs text-destructive mt-0.5">{state.fieldErrors.countedCash[0]}</p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground block font-medium">Closing notes</label>
          <Input name="notes" placeholder="Optional notes" className="w-60" />
        </div>
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? 'Closing…' : 'Close session'}
        </Button>
      </div>
    </form>
  );
}
