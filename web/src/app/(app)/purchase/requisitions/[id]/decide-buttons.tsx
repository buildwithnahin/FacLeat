'use client';

import { useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { decideRequisitionAction } from '@/server/actions/purchase';

export function DecideRequisitionButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  const handleDecision = (decision: 'APPROVE' | 'REJECT') => {
    let reason = '';
    if (decision === 'REJECT') {
      const input = prompt('Please enter the reason for rejection (optional):');
      if (input === null) return;
      reason = input.trim();
    }
    const formData = new FormData();
    formData.set('id', id);
    formData.set('decision', decision);
    if (reason) formData.set('reason', reason);

    startTransition(async () => {
      await decideRequisitionAction(formData);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => handleDecision('REJECT')}
      >
        <X className="h-4 w-4" />
        {pending ? 'Processing…' : 'Reject'}
      </Button>
      <Button
        type="button"
        variant="dark"
        disabled={pending}
        onClick={() => handleDecision('APPROVE')}
      >
        <Check className="h-4 w-4" />
        {pending ? 'Processing…' : 'Approve'}
      </Button>
    </div>
  );
}
