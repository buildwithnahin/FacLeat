'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
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
  availableRoles?: string[];
}

const COMMON_PRESETS = [
  { label: 'Purchase Requisition', module: 'purchase', action: 'requisition-approve' },
  { label: 'Purchase Order', module: 'purchase', action: 'approve' },
  { label: 'Purchase Invoice', module: 'purchase', action: 'invoice-approve' },
  { label: 'Production Plan', module: 'factory', action: 'plan-approve' },
  { label: 'Employee Transfer', module: 'hr', action: 'employee-transfer' },
  { label: 'Faulty Stock / Damage', module: 'inventory', action: 'damage' },
];

export function RuleForm({ initial, availableRoles = [] }: RuleFormProps = {}) {
  const [state, action, pending] = useActionState<ApprovalFormState, FormData>(
    upsertApprovalRuleAction,
    undefined,
  );
  const isEditing = Boolean(initial?.id);

  const [moduleVal, setModuleVal] = useState(initial?.module ?? '');
  const [actionVal, setActionVal] = useState(initial?.action ?? '');
  const [approverRoles, setApproverRoles] = useState(initial?.approverRoles?.join(', ') ?? '');

  const addRole = (role: string) => {
    const current = approverRoles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!current.includes(role)) {
      setApproverRoles([...current, role].join(', '));
    }
  };

  const applyPreset = (preset: (typeof COMMON_PRESETS)[number]) => {
    setModuleVal(preset.module);
    setActionVal(preset.action);
  };

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

      {!isEditing && (
        <div className="space-y-1.5 pb-2 border-b">
          <Label className="text-xs text-muted-foreground">Quick Presets</Label>
          <div className="flex flex-wrap gap-1">
            {COMMON_PRESETS.map((p) => (
              <button
                key={`${p.module}-${p.action}`}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-xs px-2 py-0.5 rounded border bg-muted/30 hover:bg-muted text-muted-foreground transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form action={action} className="space-y-3">
        {isEditing && <input type="hidden" name="id" value={initial?.id} />}
        <div>
          <Label>Name *</Label>
          <Input name="name" required placeholder="e.g. PO > 100k" defaultValue={initial?.name ?? ''} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label>Module</Label>
            <Input
              name="module"
              required
              placeholder="purchase"
              value={moduleVal}
              onChange={(e) => setModuleVal(e.target.value)}
            />
          </div>
          <div>
            <Label>Action</Label>
            <Input
              name="action"
              required
              placeholder="approve"
              value={actionVal}
              onChange={(e) => setActionVal(e.target.value)}
            />
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
        <div className="space-y-1">
          <Label>Approver roles (comma-separated, in order)</Label>
          <Input
            name="approverRoles"
            required
            placeholder="Manager, Director"
            value={approverRoles}
            onChange={(e) => setApproverRoles(e.target.value)}
          />
          {availableRoles.length > 0 && (
            <div className="pt-1">
              <span className="text-[11px] text-muted-foreground block mb-1">Click to add role:</span>
              <div className="flex flex-wrap gap-1">
                {availableRoles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => addRole(r)}
                    className="text-[11px] px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  >
                    + {r}
                  </button>
                ))}
              </div>
            </div>
          )}
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
