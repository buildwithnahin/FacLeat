'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Tag, Loader2 } from 'lucide-react';
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
import { createCategoryTypeAction } from '@/server/actions/product-categories';

export interface CategoryTypeDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

interface CreateTypeDialogProps {
  onTypeCreated?: (type: CategoryTypeDto) => void;
  trigger?: React.ReactNode;
}

export function CreateTypeDialog({ onTypeCreated, trigger }: CreateTypeDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createCategoryTypeAction(undefined, formData);
      if (res.error) {
        setError(res.error);
        return;
      }

      if (res.success && res.type) {
        if (onTypeCreated) {
          onTypeCreated(res.type);
        }
        setOpen(false);
        form.reset();
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" type="button">
            <Plus className="h-4 w-4 mr-1.5" />
            New type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Add Custom Type
            </DialogTitle>
            <DialogDescription>
              Create a new inventory classification type (e.g. Raw Material, Finished Goods, Work In Progress, Consumables, Hardware).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="typeName">
                Type Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="typeName"
                name="name"
                required
                placeholder="e.g. Raw Material, Finished Goods, Chemicals"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="typeCode">Code (Optional)</Label>
              <Input
                id="typeCode"
                name="code"
                placeholder="e.g. RAW_MATERIAL (auto-generated if empty)"
              />
              <p className="text-[11px] text-muted-foreground">
                Unique identifier code. Leave empty to auto-generate from the name.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="typeDescription">Description</Label>
              <Textarea
                id="typeDescription"
                name="description"
                rows={2}
                placeholder="Brief description of this classification type…"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Create Type
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
