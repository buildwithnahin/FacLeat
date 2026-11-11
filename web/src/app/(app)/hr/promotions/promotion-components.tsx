'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DesignationOption } from '@/lib/hr-master-data';
import {
  changePromotionStatusAction,
  createPromotionAction,
  type PromotionFormState,
  updatePromotionAction,
} from '@/server/actions/promotions';
import {
  PROMOTION_STATUS_LABELS,
  PROMOTION_TYPE_LABELS,
  PROMOTION_TYPES,
} from '@/server/validators/promotions';

export type SelectOption = { id: string; label: string };

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function toDateInput(value: Date | string | null | undefined) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatMoney(value: string | number) {
  const amount = typeof value === 'number' ? value : Number(value || 0);
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(amount);
}

export type EmployeePromotionDetail = {
  employeeLabel: string;
  branch: string;
  department: string;
  designation: string;
  salary: string;
};

interface PromotionFormProps {
  mode: 'create' | 'edit';
  employees: SelectOption[];
  employeeDetails: Record<string, EmployeePromotionDetail>;
  designationOptions: DesignationOption[];
  initial?: {
    id: string;
    employeeId: string;
    promotionType: string;
    newDesignation: string;
    newSalary: string;
    effectiveDate: Date | string;
    reason: string;
    remarks: string | null;
  };
}

export function PromotionForm({ mode, employees, employeeDetails, designationOptions, initial }: PromotionFormProps) {
  const action = mode === 'create' ? createPromotionAction : updatePromotionAction;
  const [state, formAction, pending] = useActionState<PromotionFormState, FormData>(action, undefined);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initial?.employeeId ?? '');
  const [selectedDesignation, setSelectedDesignation] = useState(initial?.newDesignation ?? '');
  const currentEmp = selectedEmployeeId ? employeeDetails[selectedEmployeeId] : null;
  const filteredDesignationOptions = useMemo(() => {
    const department = currentEmp?.department && currentEmp.department !== '-' ? currentEmp.department : '';
    const matches = designationOptions.filter(
      (option) => !option.department || !department || option.department === department,
    );
    const values = matches.length ? matches : designationOptions;
    const names = new Set<string>();
    return values.filter((option) => {
      if (names.has(option.name)) return false;
      names.add(option.name);
      return true;
    });
  }, [designationOptions, currentEmp?.department]);

  useEffect(() => {
    if (!selectedDesignation) return;
    if (!filteredDesignationOptions.some((option) => option.name === selectedDesignation)) {
      setSelectedDesignation('');
    }
  }, [filteredDesignationOptions, selectedDesignation]);

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="employeeId">
            Employee <span className="text-destructive">*</span>
          </Label>
          <select
            id="employeeId"
            name="employeeId"
            required
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className={selectClass}
          >
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.label}
              </option>
            ))}
          </select>
          {state?.fieldErrors?.employeeId && (
            <p className="text-xs text-destructive">{state.fieldErrors.employeeId[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="promotionType">
            Promotion Type <span className="text-destructive">*</span>
          </Label>
          <select
            id="promotionType"
            name="promotionType"
            defaultValue={initial?.promotionType ?? 'REGULAR'}
            className={selectClass}
          >
            {PROMOTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {PROMOTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentEmp && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Employee Information (Read Only)
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2 xl:grid-cols-3">
            <InfoText label="Employee" value={currentEmp.employeeLabel} />
            <InfoText label="Current Branch" value={currentEmp.branch} />
            <InfoText label="Current Department" value={currentEmp.department} />
            <InfoText label="Current Designation" value={currentEmp.designation} />
            <InfoText label="Current Salary" value={currentEmp.salary} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="newDesignation">
            New Designation <span className="text-destructive">*</span>
          </Label>
          <select
            id="newDesignation"
            name="newDesignation"
            required
            value={selectedDesignation}
            onChange={(event) => setSelectedDesignation(event.target.value)}
            className={selectClass}
          >
            <option value="">Select designation</option>
            {Array.from(new Set([selectedDesignation, ...filteredDesignationOptions.map((option) => option.name)].filter(Boolean))).map(
              (designation) => (
                <option key={designation} value={designation}>
                  {designation}
                </option>
              ),
            )}
          </select>
          {state?.fieldErrors?.newDesignation && (
            <p className="text-xs text-destructive">{state.fieldErrors.newDesignation[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="newSalary">
            New Salary <span className="text-destructive">*</span>
          </Label>
          <Input
            id="newSalary"
            name="newSalary"
            type="number"
            min="0"
            step="0.01"
            defaultValue={initial?.newSalary ?? ''}
          />
          {state?.fieldErrors?.newSalary && (
            <p className="text-xs text-destructive">{state.fieldErrors.newSalary[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="effectiveDate">
            Effective Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="effectiveDate"
            name="effectiveDate"
            type="date"
            defaultValue={toDateInput(initial?.effectiveDate)}
          />
          {state?.fieldErrors?.effectiveDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.effectiveDate[0]}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">
          Promotion Reason <span className="text-destructive">*</span>
        </Label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          defaultValue={initial?.reason ?? ''}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {state?.fieldErrors?.reason && (
          <p className="text-xs text-destructive">{state.fieldErrors.reason[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks</Label>
        <textarea
          id="remarks"
          name="remarks"
          rows={2}
          defaultValue={initial?.remarks ?? ''}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : mode === 'create' ? 'Create Promotion' : 'Save Changes'}
        </Button>
        {mode === 'edit' && (
          <Button type="button" variant="outline" asChild>
            <Link href="/hr/promotions">Cancel</Link>
          </Button>
        )}
        {state?.success && <span className="text-sm text-emerald-600">Promotion saved ✓</span>}
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}

function InfoText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function PromotionStatusActions({
  promotion,
  canSubmit,
  canManagerDecide,
}: {
  promotion: { id: string; status: string };
  canSubmit: boolean;
  canManagerDecide: boolean;
}) {
  const actions: { action: string; label: string; variant: 'default' | 'destructive' | 'outline' }[] = [];

  switch (promotion.status) {
    case 'DRAFT':
      if (canSubmit) actions.push({ action: 'submit', label: 'Submit', variant: 'default' });
      break;
    case 'PENDING_MANAGER_APPROVAL':
      if (canManagerDecide) {
        actions.push({ action: 'manager_approve', label: 'Manager Approve', variant: 'default' });
        actions.push({ action: 'manager_reject', label: 'Manager Reject', variant: 'destructive' });
      }
      break;
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col items-stretch gap-2">
      {actions.map((action) => (
        <form key={action.action} action={changePromotionStatusAction} className="w-full">
          <input type="hidden" name="id" value={promotion.id} />
          <input type="hidden" name="action" value={action.action} />
          <Button type="submit" variant={action.variant} size="sm" className="w-full whitespace-normal break-words text-center leading-tight">
            {action.label}
          </Button>
        </form>
      ))}
    </div>
  );
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'APPROVED':
      return 'success' as const;
    case 'REJECTED_BY_MANAGER':
    case 'REJECTED_BY_HR':
      return 'destructive' as const;
    case 'PENDING_MANAGER_APPROVAL':
    case 'PENDING_HR_APPROVAL':
    case 'SUBMITTED':
      return 'warning' as const;
    default:
      return 'outline' as const;
  }
}

export function PromotionTable({
  promotions,
  canWrite,
  currentUserId,
}: {
  promotions: Array<{
    id: string;
    promotionNumber: string;
    promotionType: string;
    newDesignation: string;
    newSalary: string | number;
    effectiveDate: Date | string;
    status: string;
    reportingManagerUserId: string | null;
    employee: { code: string; firstName: string; lastName: string } | null;
  }>;
  canWrite: boolean;
  currentUserId: string;
}) {
  if (promotions.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        No promotion records found. Create a new promotion to get started.
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="w-[13%] px-4 py-3 text-left">Promotion #</th>
            <th className="w-[14%] px-4 py-3 text-left">Employee</th>
            <th className="w-[13%] px-4 py-3 text-left">Type</th>
            <th className="w-[14%] px-4 py-3 text-left">New Designation</th>
            <th className="w-[12%] px-4 py-3 text-right">New Salary</th>
            <th className="w-[13%] px-4 py-3 text-left">Effective Date</th>
            <th className="w-[11%] px-4 py-3 text-left">Status</th>
            {canWrite && <th className="w-[20%] px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {promotions.map((promotion) => (
            <tr key={promotion.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-mono text-xs font-semibold text-primary break-words">{promotion.promotionNumber}</td>
              <td className="px-4 py-3">
                {promotion.employee ? (
                  <div>
                    <div className="font-medium break-words">
                      {promotion.employee.firstName} {promotion.employee.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground break-words">{promotion.employee.code}</div>
                  </div>
                ) : (
                  '-'
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="max-w-full whitespace-normal break-words leading-tight">
                  {PROMOTION_TYPE_LABELS[promotion.promotionType] ?? promotion.promotionType}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground break-words">{promotion.newDesignation}</td>
              <td className="px-4 py-3 text-right tabular-nums break-words">{formatMoney(promotion.newSalary)}</td>
              <td className="px-4 py-3 text-muted-foreground break-words">{String(promotion.effectiveDate).slice(0, 10)}</td>
              <td className="px-4 py-3 align-top">
                <Badge variant={statusBadgeVariant(promotion.status)} className="max-w-full whitespace-normal break-words leading-tight">
                  {PROMOTION_STATUS_LABELS[promotion.status] ?? promotion.status}
                </Badge>
              </td>
              {canWrite && (
                <td className="px-4 py-3 align-top text-right">
                  <div className="flex flex-col items-stretch justify-start gap-2">
                    {promotion.status === 'DRAFT' && canWrite && (
                      <Button variant="outline" size="sm" className="w-full whitespace-normal break-words text-center leading-tight" asChild>
                        <Link href={`/hr/promotions?edit=${promotion.id}`}>Edit</Link>
                      </Button>
                    )}
                    <PromotionStatusActions
                      promotion={promotion}
                      canSubmit={canWrite}
                      canManagerDecide={Boolean(
                        promotion.status === 'PENDING_MANAGER_APPROVAL' &&
                          promotion.reportingManagerUserId &&
                          currentUserId === promotion.reportingManagerUserId,
                      )}
                    />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PromotionKpiCards({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const cards = [
    { label: 'Total', value: total, color: 'text-primary' },
    { label: 'Draft', value: counts.DRAFT ?? 0, color: 'text-muted-foreground' },
    {
      label: 'Pending Manager',
      value: (counts.PENDING_MANAGER_APPROVAL ?? 0) + (counts.SUBMITTED ?? 0),
      color: 'text-amber-600',
    },
    { label: 'Completed', value: counts.COMPLETED ?? 0, color: 'text-emerald-600' },
    { label: 'Rejected', value: (counts.REJECTED_BY_MANAGER ?? 0) + (counts.REJECTED_BY_HR ?? 0), color: 'text-red-600' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground">{card.label}</div>
            <div className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
