'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { deleteCustomerAction } from '@/server/actions/crm';

interface DeleteCustomerButtonProps {
  customerId: string;
  customerName: string;
  customerCode: string;
}

export function DeleteCustomerButton({
  customerId,
  customerName,
  customerCode,
}: DeleteCustomerButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteCustomerAction(customerId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Customer "${customerName}" was deleted.`);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800 transition-colors font-normal cursor-pointer"
        title={`Delete ${customerName}`}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Confirm Delete Customer</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              Are you sure you want to permanently delete customer{' '}
              <span className="font-semibold text-foreground">{customerName}</span> (
              <span className="tabular">{customerCode}</span>)?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <strong>Note:</strong> Customers with recorded ledger activity or transactions cannot be deleted. If transactions exist, consider setting their status to <em>Inactive</em> instead.
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Deleting...
                </>
              ) : (
                'Delete Customer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
