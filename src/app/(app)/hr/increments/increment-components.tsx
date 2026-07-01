'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  changeIncrementStatusAction,
  createIncrementAction,
  type IncrementFormState,
  updateIncrementAction,
} from '@/server/actions/increments';
import {
  INCREMENT_METHOD_LABELS,
  INCREMENT_METHODS,
  INCREMENT_STATUS_LABELS,
  INCREMENT_TYPE_LABELS,
  INCREMENT_TYPES,
} from '@/server/validators/increments';

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

function formatDate(value: string | Date) {
  const text = value instanceof Date ? value.toISOString() : value;
  return text.slice(0, 10);
}

export type EmployeeIncrementDetail = {
  employeeLabel: string;
  branch: string;
  department: string;
  designation: string;
  employmentType: string;
  joiningDate: string;
  basicSalary: string;
  grossSalary: string;
};

type IncrementRecord = {
  id: string;
  incrementNumber: string;
  incrementType: string;
  incrementMethod: string;
  incrementValue: string;
  currentBasicSalary: string;
  newBasicSalary: string;
  currentGrossSalary: string;
  newGrossSalary: string;
  effectiveDate: string;
  status: string;
  reportingManagerUserId: string | null;
  employee: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
  } | null;
};

interface IncrementFormProps {
  mode: 'create' | 'edit';
  employees: SelectOption[];
  employeeDetails: Record<string, EmployeeIncrementDetail>;
  initial?: {
    id: string;
    employeeId: string;
    incrementType: string;
    incrementMethod: string;
    incrementValue: string;
    effectiveDate: Date | string;
    reason: string;
    performanceSummary: string | null;
    remarks: string | null;
  };
}

export function IncrementForm({ mode, employees, employeeDetails, initial }: IncrementFormProps) {
  const action = mode === 'create' ? createIncrementAction : updateIncrementAction;
  const [state, formAction, pending] = useActionState<IncrementFormState, FormData>(action, undefined);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initial?.employeeId ?? '');
  const [incrementMethod, setIncrementMethod] = useState(initial?.incrementMethod ?? 'PERCENTAGE');
  const [incrementValue, setIncrementValue] = useState(initial?.incrementValue ?? '');
  const currentEmp = selectedEmployeeId ? employeeDetails[selectedEmployeeId] : null;

  const calculated = useMemo(() => {
    if (!currentEmp) return null;
    const currentBasic = Number(currentEmp.basicSalary || 0);
    const currentGross = Number(currentEmp.grossSalary || 0);
    const value = Number(incrementValue || 0);
    const incrementAmount = incrementMethod === 'PERCENTAGE' ? (currentBasic * value) / 100 : value;
    return {
      incrementAmount,
      newBasic: currentBasic + incrementAmount,
      newGross: currentGross + incrementAmount,
    };
  }, [currentEmp, incrementMethod, incrementValue]);

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
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
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
          <Label htmlFor="incrementType">
            Increment Type <span className="text-destructive">*</span>
          </Label>
          <select
            id="incrementType"
            name="incrementType"
            defaultValue={initial?.incrementType ?? 'ANNUAL'}
            className={selectClass}
          >
            {INCREMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {INCREMENT_TYPE_LABELS[type]}
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
            <InfoText label="Employment Type" value={currentEmp.employmentType} />
            <InfoText label="Joining Date" value={currentEmp.joiningDate} />
            <InfoText label="Current Basic Salary" value={formatMoney(currentEmp.basicSalary)} />
            <InfoText label="Current Gross Salary" value={formatMoney(currentEmp.grossSalary)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="incrementMethod">
            Increment Method <span className="text-destructive">*</span>
          </Label>
          <select
            id="incrementMethod"
            name="incrementMethod"
            value={incrementMethod}
            onChange={(event) => setIncrementMethod(event.target.value)}
            className={selectClass}
          >
            {INCREMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {INCREMENT_METHOD_LABELS[method]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="incrementValue">
            Increment Value <span className="text-destructive">*</span>
          </Label>
          <Input
            id="incrementValue"
            name="incrementValue"
            type="number"
            min="0"
            step="0.01"
            value={incrementValue}
            onChange={(event) => setIncrementValue(event.target.value)}
          />
          {state?.fieldErrors?.incrementValue && (
            <p className="text-xs text-destructive">{state.fieldErrors.incrementValue[0]}</p>
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

        <div className="space-y-2">
          <Label>Auto Calculated</Label>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            {calculated ? formatMoney(calculated.incrementAmount) : 'Select employee'}
          </div>
        </div>
      </div>

      {currentEmp && calculated && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyBox label="Current Basic Salary" value={formatMoney(currentEmp.basicSalary)} />
          <ReadOnlyBox label="New Basic Salary" value={formatMoney(calculated.newBasic)} />
          <ReadOnlyBox label="Current Gross Salary" value={formatMoney(currentEmp.grossSalary)} />
          <ReadOnlyBox label="New Gross Salary" value={formatMoney(calculated.newGross)} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reason">
          Reason <span className="text-destructive">*</span>
        </Label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          defaultValue={initial?.reason ?? ''}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {state?.fieldErrors?.reason && <p className="text-xs text-destructive">{state.fieldErrors.reason[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="performanceSummary">Performance Summary</Label>
        <textarea
          id="performanceSummary"
          name="performanceSummary"
          rows={3}
          defaultValue={initial?.performanceSummary ?? ''}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
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
          {pending ? 'Saving...' : mode === 'create' ? 'Create Increment' : 'Save Changes'}
        </Button>
        {mode === 'edit' && (
          <Button type="button" variant="outline" asChild>
            <Link href="/hr/increments">Cancel</Link>
          </Button>
        )}
        {state?.success && <span className="text-sm text-emerald-600">Increment saved ✓</span>}
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

function ReadOnlyBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">{value}</div>
    </div>
  );
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'APPLIED':
    case 'APPROVED':
      return 'success' as const;
    case 'REJECTED':
      return 'destructive' as const;
    case 'PENDING_HR_APPROVAL':
    case 'PENDING_ACCOUNTS_APPROVAL':
    case 'PENDING_MANAGER_APPROVAL':
    case 'SUBMITTED':
      return 'warning' as const;
    default:
      return 'outline' as const;
  }
}

function IncrementStatusActions({
  increment,
  canSubmit,
  canHrApprove,
  canAccountsApprove,
  canManagerApprove,
  canApply,
}: {
  increment: IncrementRecord;
  canSubmit: boolean;
  canHrApprove: boolean;
  canAccountsApprove: boolean;
  canManagerApprove: boolean;
  canApply: boolean;
}) {
  const actions: Array<{
    action: string;
    label: string;
    variant: 'default' | 'destructive' | 'outline';
    budgetVerified?: boolean;
  }> = [];

  switch (increment.status) {
    case 'DRAFT':
      if (canSubmit) actions.push({ action: 'submit', label: 'Submit', variant: 'default' });
      break;
    case 'PENDING_HR_APPROVAL':
      if (canHrApprove) {
        actions.push({ action: 'hr_approve', label: 'HR Approve', variant: 'default' });
        actions.push({ action: 'hr_reject', label: 'HR Reject', variant: 'destructive' });
      }
      break;
    case 'PENDING_ACCOUNTS_APPROVAL':
      if (canAccountsApprove) {
        actions.push({ action: 'accounts_approve', label: 'Accounts Approve', variant: 'default', budgetVerified: true });
        actions.push({ action: 'accounts_reject', label: 'Accounts Reject', variant: 'destructive', budgetVerified: false });
      }
      break;
    case 'PENDING_MANAGER_APPROVAL':
      if (canManagerApprove) {
        actions.push({ action: 'manager_approve', label: 'Manager Approve', variant: 'default' });
        actions.push({ action: 'manager_reject', label: 'Manager Reject', variant: 'destructive' });
      }
      break;
    case 'APPROVED':
      if (canApply) actions.push({ action: 'apply', label: 'Apply Increment', variant: 'outline' });
      break;
  }

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">No actions</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <form key={action.action} action={changeIncrementStatusAction}>
          <input type="hidden" name="id" value={increment.id} />
          <input type="hidden" name="action" value={action.action} />
          {typeof action.budgetVerified === 'boolean' && (
            <input type="hidden" name="budgetVerified" value={action.budgetVerified ? 'yes' : 'no'} />
          )}
          <Button type="submit" variant={action.variant} size="sm">
            {action.label}
          </Button>
        </form>
      ))}
    </div>
  );
}

export function IncrementKpiCards({ counts }: { counts: Record<string, number> }) {
  const items = [
    { key: 'TOTAL', label: 'Total', value: Object.values(counts).reduce((sum, count) => sum + count, 0), tone: 'text-blue-600' },
    { key: 'DRAFT', label: 'Draft', value: counts.DRAFT ?? 0, tone: 'text-slate-700' },
    { key: 'PENDING_HR_APPROVAL', label: 'Pending HR', value: counts.PENDING_HR_APPROVAL ?? 0, tone: 'text-amber-600' },
    {
      key: 'PENDING_ACCOUNTS_APPROVAL',
      label: 'Pending Accounts',
      value: counts.PENDING_ACCOUNTS_APPROVAL ?? 0,
      tone: 'text-orange-600',
    },
    {
      key: 'PENDING_MANAGER_APPROVAL',
      label: 'Pending Manager',
      value: counts.PENDING_MANAGER_APPROVAL ?? 0,
      tone: 'text-yellow-600',
    },
    { key: 'APPROVED', label: 'Approved', value: counts.APPROVED ?? 0, tone: 'text-indigo-600' },
    { key: 'APPLIED', label: 'Applied', value: counts.APPLIED ?? 0, tone: 'text-emerald-600' },
    { key: 'REJECTED', label: 'Rejected', value: counts.REJECTED ?? 0, tone: 'text-red-600' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-8">
      {items.map((item) => (
        <Card key={item.key}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className={`mt-2 text-3xl font-bold ${item.tone}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function IncrementTable({
  increments,
  canSubmit,
  canHrApprove,
  canAccountsApprove,
  canApply,
  currentUserId,
}: {
  increments: IncrementRecord[];
  canSubmit: boolean;
  canHrApprove: boolean;
  canAccountsApprove: boolean;
  canApply: boolean;
  currentUserId: string;
}) {
  if (increments.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground">
        No increment records found. Create a new increment to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {increments.map((increment) => {
        const employeeName = increment.employee
          ? `${increment.employee.firstName} ${increment.employee.lastName}`
          : 'Unknown employee';
        const canManagerApprove = currentUserId === increment.reportingManagerUserId;

        return (
          <div
            key={increment.id}
            className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[1.2fr_1.6fr_1fr_1.2fr_1.1fr_1.2fr_1.5fr]"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Increment #</p>
              <p className="text-sm font-semibold text-primary">{increment.incrementNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</p>
              <p className="text-sm font-semibold">{employeeName}</p>
              <p className="text-xs text-muted-foreground">{increment.employee?.code ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
              <p className="text-sm">{INCREMENT_TYPE_LABELS[increment.incrementType]}</p>
              <p className="text-xs text-muted-foreground">{INCREMENT_METHOD_LABELS[increment.incrementMethod]}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Salary</p>
              <p className="text-sm">{formatMoney(increment.currentBasicSalary)}</p>
              <p className="text-xs text-muted-foreground">Gross {formatMoney(increment.currentGrossSalary)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Salary</p>
              <p className="text-sm">{formatMoney(increment.newBasicSalary)}</p>
              <p className="text-xs text-muted-foreground">Gross {formatMoney(increment.newGrossSalary)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Effective Date</p>
              <p className="text-sm">{formatDate(increment.effectiveDate)}</p>
              <p className="text-xs text-muted-foreground">Value {formatMoney(increment.incrementValue)}</p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(increment.status)}>
                  {INCREMENT_STATUS_LABELS[increment.status] ?? increment.status}
                </Badge>
                {increment.status === 'DRAFT' && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/hr/increments?edit=${increment.id}`}>Edit</Link>
                  </Button>
                )}
              </div>
              <IncrementStatusActions
                increment={increment}
                canSubmit={canSubmit}
                canHrApprove={canHrApprove}
                canAccountsApprove={canAccountsApprove}
                canManagerApprove={canManagerApprove}
                canApply={canApply}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
