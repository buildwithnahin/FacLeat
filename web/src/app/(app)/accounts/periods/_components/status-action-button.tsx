'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setPeriodStatusAction } from '@/server/actions/accounts';
import { Loader2 } from 'lucide-react';

interface Props {
  id: string;
  status: 'OPEN' | 'LOCKED' | 'CLOSED';
  label: string;
  danger?: boolean;
}

export function StatusActionButton({ id, status, label, danger }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (danger && !confirm('Are you sure you want to permanently CLOSE this fiscal period? This cannot be undone.')) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      fd.set('status', status);
      const res = await setPeriodStatusAction(fd);
      if (res?.error) {
        setError(res.error);
        alert(res.error);
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end">
      <Button
        type="button"
        size="sm"
        variant={danger ? 'destructive' : 'outline'}
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
        {label}
      </Button>
      {error && <span className="text-[10px] text-destructive mt-0.5">{error}</span>}
    </div>
  );
}
