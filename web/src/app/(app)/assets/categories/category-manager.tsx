'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Edit2, Plus, Sparkles, X, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table';
import {
  upsertAssetCategoryAction,
  type AssetFormState,
} from '@/server/actions/assets';
import { DEPRECIATION_METHODS } from '@/server/validators/assets';
import { toast } from 'sonner';

export interface AssetCategoryRow {
  id: string;
  name: string;
  description?: string | null;
  depreciationMethod: string;
  defaultLifeMonths: number;
  defaultSalvageRate: string;
  _count: { assets: number };
}

export function CategoryManager({
  initialCategories,
}: {
  initialCategories: AssetCategoryRow[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState<AssetCategoryRow | null>(null);

  const [state, action, pending] = useActionState<AssetFormState, FormData>(
    upsertAssetCategoryAction,
    undefined,
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(editing ? 'Category updated successfully' : 'Category created successfully');
      setEditing(null);
      formRef.current?.reset();
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.success, state?.error, editing, router]);

  const totalAssets = initialCategories.reduce((sum, c) => sum + (c._count?.assets || 0), 0);

  return (
    <div className="space-y-6">
      {/* Category Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Asset Categories
            </p>
            <p className="text-2xl font-bold mt-1">{initialCategories.length}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Layers className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Categorized Assets
            </p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{totalAssets}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <Check className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Methods
            </p>
            <p className="text-2xl font-bold mt-1">
              {new Set(initialCategories.map((c) => c.depreciationMethod)).size}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Sparkles className="h-5 w-5" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6">
        {/* Categories List */}
        <Card className="p-0 overflow-hidden shadow-sm border">
          <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between bg-muted/20">
            <span>
              {initialCategories.length} Categor{initialCategories.length === 1 ? 'y' : 'ies'}
            </span>
            <span className="text-xs text-muted-foreground">Depreciation Classifications</span>
          </div>
          <DataTable
            rows={initialCategories}
            rowKey={(r) => r.id}
            empty="No asset categories configured yet."
            columns={[
              {
                key: 'name',
                header: 'Name',
                cell: (r) => (
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground text-xs">{r.name}</span>
                    {r.description && (
                      <span className="text-[11px] text-muted-foreground line-clamp-1">
                        {r.description}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: 'method',
                header: 'Method',
                cell: (r) => (
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {r.depreciationMethod.replace('_', ' ').toLowerCase()}
                  </Badge>
                ),
              },
              {
                key: 'life',
                header: 'Useful Life',
                align: 'right',
                cell: (r) => <span className="tabular text-xs">{r.defaultLifeMonths} mo</span>,
              },
              {
                key: 'salvage',
                header: 'Salvage Rate',
                align: 'right',
                cell: (r) => (
                  <span className="tabular text-xs font-mono">
                    {(Number(r.defaultSalvageRate) * 100).toFixed(0)}%
                  </span>
                ),
              },
              {
                key: 'assets',
                header: 'Assets',
                align: 'right',
                cell: (r) => (
                  <span className="tabular text-xs font-semibold text-primary">
                    {r._count?.assets || 0}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                cell: (r) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => {
                      setEditing(r);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <Edit2 className="h-3 w-3" /> Edit
                  </Button>
                ),
              },
            ]}
          />
        </Card>

        {/* Add / Edit Category Form */}
        <Card className="p-5 space-y-4 shadow-sm border h-fit">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-semibold text-sm">
                {editing ? 'Edit Category' : 'Add New Category'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editing
                  ? `Updating ${editing.name}`
                  : 'Define category depreciation defaults for auto-fill'}
              </p>
            </div>
            {editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  formRef.current?.reset();
                }}
                className="h-7 text-xs gap-1 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
          </div>

          <form ref={formRef} action={action} className="space-y-3">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="space-y-1">
              <Label className="text-xs">Category Name *</Label>
              <Input
                name="name"
                placeholder="e.g. Leather Processing Machinery, Office IT"
                defaultValue={editing?.name ?? ''}
                key={editing?.id ?? 'new-name'}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                name="description"
                placeholder="Scope, warranty standards..."
                rows={2}
                defaultValue={editing?.description ?? ''}
                key={editing?.id ?? 'new-desc'}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Depreciation Method</Label>
              <select
                name="depreciationMethod"
                defaultValue={editing?.depreciationMethod ?? 'STRAIGHT_LINE'}
                key={editing?.id ?? 'new-method'}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm"
              >
                {DEPRECIATION_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace('_', ' ').toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Useful Life (Months)</Label>
                <Input
                  name="defaultLifeMonths"
                  type="number"
                  min="1"
                  defaultValue={editing?.defaultLifeMonths ?? 60}
                  key={editing?.id ?? 'new-life'}
                  className="text-xs h-9"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Salvage Rate (0.00-1.00)</Label>
                <Input
                  name="defaultSalvageRate"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  defaultValue={editing?.defaultSalvageRate ? Number(editing.defaultSalvageRate) : 0}
                  key={editing?.id ?? 'new-salvage'}
                  className="text-xs h-9"
                  required
                />
              </div>
            </div>

            <Button type="submit" variant="dark" className="w-full gap-1.5 mt-2" disabled={pending}>
              {pending ? (
                'Saving...'
              ) : editing ? (
                <>
                  <Check className="h-4 w-4" /> Update Category
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Save Category
                </>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
