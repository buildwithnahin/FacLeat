'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  upsertApprovalRuleAction,
  type ApprovalFormState,
} from '@/server/actions/approvals';

export interface RuleFormProps {
  initial?: {
    id: string;
    name: string;
    module: string;
    action: string;
    minAmount: string;
    approverRoles: string[];
    escalateAfterHours?: number;
    isActive: boolean;
    description?: string | null;
  } | null;
}

export function RuleForm({ initial }: RuleFormProps = {}) {
  const [state, action, pending] = useActionState<ApprovalFormState, FormData>(
    upsertApprovalRuleAction,
    undefined,
  );
  const isEditing = Boolean(initial?.id);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{isEditing ? 'Edit approval rule' : 'Add approval rule'}</h3>
        {isEditing && (
          <Button variant="ghost" size="xs" asChild>
            <Link href="/approvals/rules">Cancel edit</Link>
          </Button>
        )}
      </div>
      <form action={action} className="space-y-3">
        {isEditing && <input type="hidden" name="id" value={initial?.id} />}
        <div>
          <Label>Name *</Label>
          <Input name="name" required placeholder="e.g. PO > 100k" defaultValue={initial?.name ?? ''} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label>Module</Label>
            <Input name="module" required placeholder="purchase" defaultValue={initial?.module ?? ''} />
          </div>
          <div>
            <Label>Action</Label>
            <Input name="action" required placeholder="write" defaultValue={initial?.action ?? ''} />
          </div>
        </div>
        <div>
          <Label>Minimum amount</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            name="minAmount"
            defaultValue={initial?.minAmount ? Number(initial.minAmount) : 0}
          />
        </div>
        <div>
          <Label>Approver roles (comma-separated, in order)</Label>
          <Input
            name="approverRoles"
            required
            placeholder="Manager, Director"
            defaultValue={initial?.approverRoles?.join(', ') ?? ''}
          />
        </div>
        <div>
          <Label>Escalate after (hours)</Label>
          <Input
            type="number"
            min="1"
            name="escalateAfterHours"
            defaultValue={initial?.escalateAfterHours ?? 24}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="isActive"
            type="checkbox"
            name="isActive"
            defaultChecked={initial ? initial.isActive : true}
          />
          <Label htmlFor="isActive" className="mb-0">
            Active
          </Label>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea name="description" rows={2} defaultValue={initial?.description ?? ''} />
        </div>
        <Button type="submit" variant="dark" className="w-full" disabled={pending}>
          {pending ? 'Saving…' : isEditing ? 'Update rule' : 'Save rule'}
        </Button>
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        {state?.success && <p className="text-xs text-emerald-600">Saved successfully.</p>}
      </form>
    </Card>
  );
}
