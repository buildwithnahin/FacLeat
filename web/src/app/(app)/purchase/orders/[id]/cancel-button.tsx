'use client';

import { useTransition } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cancelPurchaseOrderAction } from '@/server/actions/purchase';

export function CancelPurchaseOrderButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm('Are you sure you want to cancel this purchase order? This action cannot be undone.')) {
          return;
        }
        const formData = new FormData();
        formData.set('id', id);
        startTransition(async () => {
          await cancelPurchaseOrderAction(formData);
        });
      }}
    >
      <X className="h-4 w-4" />
      {pending ? 'Cancelling…' : 'Cancel'}
    </Button>
  );
}
