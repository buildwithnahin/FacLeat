'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { addProductionStageAction } from '@/server/actions/factory';

const SUGGESTED_STAGES = [
  'Cutting',
  'Skiving',
  'Stitching',
  'Assembly',
  'Finishing',
  'Quality Control',
  'Packaging',
];

export function AddStageDialog({
  orderId,
  nextSequence,
  disabled,
}: {
  orderId: string;
  nextSequence: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [name, setName] = useState('');
  const [sequence, setSequence] = useState((nextSequence ?? 1).toString());
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setSequence((nextSequence ?? 1).toString());
    }
  }, [open, nextSequence]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('orderId', orderId);
    formData.set('name', name);
    formData.set('sequence', sequence);
    formData.set('notes', notes);

    startTransition(async () => {
      const res = await addProductionStageAction(undefined, formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setName('');
      setNotes('');
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          Add stage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Production Stage</DialogTitle>
            <DialogDescription>
              Define a manufacturing or quality step in this production workflow.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mt-3 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-3 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Stage name</Label>
              <Input
                value={name ?? ''}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Quality Control, Packaging…"
                required
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {SUGGESTED_STAGES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setName(s)}
                    className="text-[11px] bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground px-2 py-0.5 rounded transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Sequence (#)</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={sequence ?? ''}
                onChange={(e) => setSequence(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                rows={2}
                value={notes ?? ''}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special specifications or inspection requirements"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Add Stage'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
