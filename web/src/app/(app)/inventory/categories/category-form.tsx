'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  createCategoryAction,
  updateCategoryAction,
  type CategoryFormState,
} from '@/server/actions/product-categories';
import { CreateTypeDialog, type CategoryTypeDto } from './create-type-dialog';

export interface CategoryFormProps {
  mode: 'create' | 'edit';
  initial?: {
    id: string;
    name: string;
    type?: string | null;
    description: string | null;
    parentId: string | null;
  };
  parents: { id: string; name: string }[];
  types?: CategoryTypeDto[];
}

export function CategoryForm({ mode, initial, parents, types = [] }: CategoryFormProps) {
  const action = mode === 'create' ? createCategoryAction : updateCategoryAction;
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(action, undefined);
  const [typeList, setTypeList] = useState<CategoryTypeDto[]>(types);
  const [selectedType, setSelectedType] = useState<string>(initial?.type ?? '');

  const E = (f: string) => state?.fieldErrors?.[f]?.[0];

  const handleTypeCreated = (newType: CategoryTypeDto) => {
    setTypeList((prev) => {
      if (prev.some((t) => t.code === newType.code)) return prev;
      return [...prev, newType].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSelectedType(newType.code);
  };

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}
      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category Name */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" required defaultValue={initial?.name} placeholder="e.g. Full Grain Leather, Casual Shoes" />
            {E('name') && <p className="text-xs text-destructive">{E('name')}</p>}
          </div>

          {/* Category Type Selection & Dynamic Creation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="type">Category Type</Label>
              <CreateTypeDialog
                onTypeCreated={handleTypeCreated}
                trigger={
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <Plus className="h-3 w-3" /> Add Custom Type
                  </button>
                }
              />
            </div>
            <select
              id="type"
              name="type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">— Unassigned Type —</option>
              {typeList.map((t) => (
                <option key={t.id || t.code} value={t.code}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Classify this category under a standard or custom dynamic type.
            </p>
          </div>

          {/* Parent Category */}
          <div className="space-y-2">
            <Label htmlFor="parentId">Parent category</Label>
            <select
              id="parentId"
              name="parentId"
              defaultValue={initial?.parentId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">— top level —</option>
              {parents
                .filter((p) => p.id !== initial?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Optional hierarchy for nesting sub-categories.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={initial?.description ?? ''}
              placeholder="Detailed description of this category…"
            />
          </div>
        </CardContent>
      </Card>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create category' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/inventory/categories">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
