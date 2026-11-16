'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertTriangle, Building2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  createWarehouseAction,
  updateWarehouseAction,
  type WarehouseFormState,
} from '@/server/actions/warehouses';

const TYPES = [
  ['MAIN', 'Main'],
  ['STORE', 'Store'],
  ['WIP', 'Work-in-progress'],
  ['QUARANTINE', 'Quarantine'],
  ['DAMAGED', 'Damaged'],
  ['SHOWROOM', 'Showroom'],
] as const;

export interface WarehouseFormProps {
  mode: 'create' | 'edit';
  initial?: {
    id: string;
    branchId: string;
    code: string;
    name: string;
    type: (typeof TYPES)[number][0];
    address: string | null;
    isActive: boolean;
  };
  branches: { id: string; name: string; code: string }[];
  activeBranchId?: string | null;
  activeBranchName?: string | null;
}

export function WarehouseForm({
  mode,
  initial,
  branches,
  activeBranchId,
  activeBranchName,
}: WarehouseFormProps) {
  const action = mode === 'create' ? createWarehouseAction : updateWarehouseAction;
  const [state, formAction, pending] = useActionState<WarehouseFormState, FormData>(action, undefined);
  const E = (f: string) => state?.fieldErrors?.[f]?.[0];

  const hasActiveBranch = Boolean(activeBranchId);
  const isBlocked = mode === 'create' && !hasActiveBranch;

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}

      {/* Warning prompt when no branch is selected from top selector */}
      {mode === 'create' && !hasActiveBranch && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Branch selection required</h4>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                You must select a branch from the <strong>top selector button</strong> (in the header above) before you can add a new warehouse.
                Creating a warehouse is disabled until an active branch is chosen.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active branch status banner */}
      {mode === 'create' && hasActiveBranch && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 p-3 text-emerald-900 dark:text-emerald-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Creating warehouse under active branch: <strong>{activeBranchName || activeBranchId}</strong>
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Selected via top header
          </span>
        </div>
      )}

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="branchId">
              Branch <span className="text-destructive">*</span>
            </Label>
            {mode === 'create' ? (
              hasActiveBranch ? (
                <>
                  <input type="hidden" name="branchId" value={activeBranchId!} />
                  <select
                    id="branchId"
                    disabled
                    value={activeBranchId!}
                    className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm shadow-sm cursor-not-allowed text-foreground"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Automatically assigned to active branch selected from the top selector.
                  </p>
                </>
              ) : (
                <>
                  <select
                    id="branchId"
                    name="branchId"
                    disabled
                    className="flex h-9 w-full rounded-md border border-dashed border-amber-500/60 bg-amber-50/30 px-3 py-1 text-sm shadow-sm cursor-not-allowed text-muted-foreground"
                  >
                    <option value="">— Select a branch from top selector button first —</option>
                  </select>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Please select a branch from the top header button to enable this form.
                  </p>
                </>
              )
            ) : (
              <select
                id="branchId"
                name="branchId"
                required
                defaultValue={initial?.branchId ?? ''}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">— select branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              disabled={isBlocked}
              defaultValue={initial?.type ?? 'MAIN'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">
              Code <span className="text-destructive">*</span>
            </Label>
            <Input id="code" name="code" required disabled={isBlocked} defaultValue={initial?.code} />
            {E('code') && <p className="text-xs text-destructive">{E('code')}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" required disabled={isBlocked} defaultValue={initial?.name} />
            {E('name') && <p className="text-xs text-destructive">{E('name')}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              rows={2}
              disabled={isBlocked}
              defaultValue={initial?.address ?? ''}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              disabled={isBlocked}
              defaultChecked={initial?.isActive ?? true}
              className="h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="text-sm">Active</span>
          </label>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || isBlocked}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create warehouse' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/warehouse">Cancel</Link>
        </Button>
        {isBlocked && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Select a branch from the top selector button to enable warehouse creation
          </span>
        )}
      </div>
    </form>
  );
}
