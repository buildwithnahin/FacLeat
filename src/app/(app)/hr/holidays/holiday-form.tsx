'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { createHolidayAction, updateHolidayAction, type HolidayFormState } from '@/server/actions/holidays';
import { HOLIDAY_STATUSES, HOLIDAY_TYPES } from '@/server/validators/holidays';

const HOLIDAY_TYPE_LABELS: Record<(typeof HOLIDAY_TYPES)[number], string> = {
  GOVERNMENT_HOLIDAY: 'Government Holiday',
  COMPANY_HOLIDAY: 'Company Holiday',
  RELIGIOUS_HOLIDAY: 'Religious Holiday',
  FESTIVAL_HOLIDAY: 'Festival Holiday',
  WEEKLY_HOLIDAY: 'Weekly Holiday',
  SPECIAL_HOLIDAY: 'Special Holiday',
};

export interface HolidayFormProps {
  mode: 'create' | 'edit';
  branches: { id: string; name: string; code: string }[];
  initial?: {
    id: string;
    name: string;
    code: string;
    startDate: string;
    endDate: string;
    type: string;
    branchId: string | null;
    isPaid: boolean;
    status: string;
    description: string | null;
  };
}

export function HolidayForm({ mode, branches, initial }: HolidayFormProps) {
  const action = mode === 'create' ? createHolidayAction : updateHolidayAction;
  const [state, formAction, pending] = useActionState<HolidayFormState, FormData>(action, undefined);
  const E = (field: string) => state?.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">
              Holiday Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" required defaultValue={initial?.name} />
            {E('name') && <p className="text-xs text-destructive">{E('name')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Holiday Code</Label>
            <Input id="code" name="code" defaultValue={initial?.code} placeholder="Auto generated if blank" />
            {E('code') && <p className="text-xs text-destructive">{E('code')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">
              Start Date <span className="text-destructive">*</span>
            </Label>
            <Input id="startDate" name="startDate" type="date" required defaultValue={initial?.startDate} />
            {E('startDate') && <p className="text-xs text-destructive">{E('startDate')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">
              End Date <span className="text-destructive">*</span>
            </Label>
            <Input id="endDate" name="endDate" type="date" required defaultValue={initial?.endDate} />
            {E('endDate') && <p className="text-xs text-destructive">{E('endDate')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">
              Holiday Type <span className="text-destructive">*</span>
            </Label>
            <select
              id="type"
              name="type"
              defaultValue={initial?.type ?? 'GOVERNMENT_HOLIDAY'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {HOLIDAY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {HOLIDAY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            {E('type') && <p className="text-xs text-destructive">{E('type')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchId">Branch</Label>
            <select
              id="branchId"
              name="branchId"
              defaultValue={initial?.branchId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} · {branch.name}
                </option>
              ))}
            </select>
            {E('branchId') && <p className="text-xs text-destructive">{E('branchId')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={initial?.status ?? 'ACTIVE'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {HOLIDAY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 rounded-lg border bg-muted/10 p-4">
              <input type="checkbox" name="isPaid" defaultChecked={initial?.isPaid ?? true} className="h-4 w-4 accent-primary" />
              <div>
                <div className="text-sm font-medium">Is paid holiday</div>
                <div className="text-xs text-muted-foreground">Paid holidays should not reduce payroll payables.</div>
              </div>
            </label>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={initial?.description ?? ''} />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Save Holiday' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/hr/holidays">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
