'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  changeConfirmationStatusAction,
  createConfirmationAction,
  type ConfirmationFormState,
  updateConfirmationAction,
} from '@/server/actions/confirmations';
import {
  CONFIRMATION_STATUS_LABELS,
  CONFIRMATION_TYPE_LABELS,
  CONFIRMATION_TYPES,
} from '@/server/validators/confirmations';

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

function formatDate(value: string | Date | null) {
  if (!value) return '-';
  const text = value instanceof Date ? value.toISOString() : value;
  return text.slice(0, 10);
}

type EmployeeConfirmationDetail = {
  employeeLabel: string;
  branch: string;
  department: string;
  designation: string;
  employmentType: string;
  joiningDate: string;
  probationEndDate: string;
  basicSalary: string;
  grossSalary: string;
  reportingManager: string;
};

type ConfirmationRecord = {
  id: string;
  confirmationNumber: string;
  confirmationType: string;
  probationEndDate: string | null;
  effectiveDate: string;
  salaryRevisionRequired: boolean;
  incrementAmount: string;
  currentBasicSalary: string;
  newBasicSalary: string;
  currentGrossSalary: string;
  newGrossSalary: string;
  benefitsRevision: string | null;
  status: string;
  employee: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
  } | null;
};

interface ConfirmationFormProps {
  mode: 'create' | 'edit';
  employees: SelectOption[];
  employeeDetails: Record<string, EmployeeConfirmationDetail>;
  initial?: {
    id: string;
    employeeId: string;
    confirmationType: string;
    probationEndDate: Date | string | null;
    effectiveDate: Date | string;
    salaryRevisionRequired: boolean;
    incrementAmount: string;
    benefitsRevision: string | null;
    reason: string;
    performanceSummary: string | null;
    remarks: string | null;
  };
}

export function ConfirmationForm({ mode, employees, employeeDetails, initial }: ConfirmationFormProps) {
  const action = mode === 'create' ? createConfirmationAction : updateConfirmationAction;
  const [state, formAction, pending] = useActionState<ConfirmationFormState, FormData>(action, undefined);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initial?.employeeId ?? '');
  const [salaryRevisionRequired, setSalaryRevisionRequired] = useState(Boolean(initial?.salaryRevisionRequired));
  const [incrementAmount, setIncrementAmount] = useState(initial?.incrementAmount ?? '');
  const currentEmp = selectedEmployeeId ? employeeDetails[selectedEmployeeId] : null;

  const calculated = useMemo(() => {
    if (!currentEmp) return null;
    const currentBasic = Number(currentEmp.basicSalary || 0);
    const currentGross = Number(currentEmp.grossSalary || 0);
    const amount = Number(incrementAmount || 0);
    return {
      newBasic: currentBasic + amount,
      newGross: currentGross + amount,
    };
  }, [currentEmp, incrementAmount]);

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
          <Label htmlFor="confirmationType">
            Confirmation Type <span className="text-destructive">*</span>
          </Label>
          <select
            id="confirmationType"
            name="confirmationType"
            defaultValue={initial?.confirmationType ?? 'PROBATION_TO_PERMANENT'}
            className={selectClass}
          >
            {CONFIRMATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {CONFIRMATION_TYPE_LABELS[type]}
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
            <InfoText label="Branch" value={currentEmp.branch} />
            <InfoText label="Department" value={currentEmp.department} />
            <InfoText label="Designation" value={currentEmp.designation} />
            <InfoText label="Employment Type" value={currentEmp.employmentType} />
            <InfoText label="Joining Date" value={currentEmp.joiningDate} />
            <InfoText label="Reporting Manager" value={currentEmp.reportingManager} />
            <InfoText label="Current Basic Salary" value={formatMoney(currentEmp.basicSalary)} />
            <InfoText label="Current Gross Salary" value={formatMoney(currentEmp.grossSalary)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="probationEndDate">Probation / Internship End Date</Label>
          <Input
            id="probationEndDate"
            name="probationEndDate"
            type="date"
            defaultValue={toDateInput(initial?.probationEndDate)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="effectiveDate">
            Effective Date <span className="text-destructive">*</span>
          </Label>
          <Input id="effectiveDate" name="effectiveDate" type="date" defaultValue={toDateInput(initial?.effectiveDate)} />
          {state?.fieldErrors?.effectiveDate && (
            <p className="text-xs text-destructive">{state.fieldErrors.effectiveDate[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="salaryRevisionRequired">Salary Revision Required?</Label>
          <select
            id="salaryRevisionRequired"
            name="salaryRevisionRequired"
            value={salaryRevisionRequired ? 'yes' : 'no'}
            onChange={(event) => setSalaryRevisionRequired(event.target.value === 'yes')}
            className={selectClass}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="incrementAmount">Increment Amount</Label>
          <Input
            id="incrementAmount"
            name="incrementAmount"
            type="number"
            min="0"
            step="0.01"
            value={incrementAmount}
            onChange={(event) => setIncrementAmount(event.target.value)}
            disabled={!salaryRevisionRequired}
          />
          {state?.fieldErrors?.incrementAmount && (
            <p className="text-xs text-destructive">{state.fieldErrors.incrementAmount[0]}</p>
          )}
        </div>
      </div>

      {currentEmp && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyBox label="Current Basic Salary" value={formatMoney(currentEmp.basicSalary)} />
          <ReadOnlyBox
            label="New Basic Salary"
            value={formatMoney(salaryRevisionRequired && calculated ? calculated.newBasic : currentEmp.basicSalary)}
          />
          <ReadOnlyBox label="Current Gross Salary" value={formatMoney(currentEmp.grossSalary)} />
          <ReadOnlyBox
            label="New Gross Salary"
            value={formatMoney(salaryRevisionRequired && calculated ? calculated.newGross : currentEmp.grossSalary)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="benefitsRevision">Benefits Revision</Label>
        <textarea
          id="benefitsRevision"
          name="benefitsRevision"
          rows={2}
          defaultValue={initial?.benefitsRevision ?? ''}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

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
          {pending ? 'Saving...' : mode === 'create' ? 'Create Confirmation' : 'Save Changes'}
        </Button>
        {mode === 'edit' && (
          <Button type="button" variant="outline" asChild>
            <Link href="/hr/confirmations">Cancel</Link>
          </Button>
        )}
        {state?.success && <span className="text-sm text-emerald-600">Confirmation saved ✓</span>}
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
    case 'CONFIRMED':
      return 'success' as const;
    case 'REJECTED':
      return 'destructive' as const;
    case 'EXTENDED':
    case 'SENT_BACK':
      return 'outline' as const;
    case 'PENDING_MANAGER_APPROVAL':
    case 'PENDING_HR_APPROVAL':
    case 'PENDING_ACCOUNTS_APPROVAL':
      return 'warning' as const;
    default:
      return 'outline' as const;
  }
}

function ConfirmationStatusActions({
  confirmation,
  canSubmit,
  canHrApprove,
  canAccountsApprove,
  canManagerApprove,
}: {
  confirmation: ConfirmationRecord;
  canSubmit: boolean;
  canHrApprove: boolean;
  canAccountsApprove: boolean;
  canManagerApprove: boolean;
}) {
  const actions: Array<{ action: string; label: string; variant: 'default' | 'destructive' | 'outline' }> = [];

  switch (confirmation.status) {
    case 'DRAFT':
    case 'SENT_BACK':
      if (canSubmit) actions.push({ action: 'submit', label: 'Submit to HR', variant: 'default' });
      if (canSubmit) actions.push({ action: 'cancel', label: 'Cancel', variant: 'outline' });
      break;
    case 'PENDING_MANAGER_APPROVAL':
      if (canManagerApprove) {
        actions.push({ action: 'manager_approve', label: 'Manager Approve', variant: 'default' });
        actions.push({ action: 'manager_send_back', label: 'Send Back', variant: 'outline' });
        actions.push({ action: 'manager_extend', label: 'Extend', variant: 'outline' });
        actions.push({ action: 'manager_reject', label: 'Reject', variant: 'destructive' });
      }
      break;
    case 'PENDING_HR_APPROVAL':
      if (canHrApprove) {
        actions.push({ action: 'hr_approve', label: 'HR Approve', variant: 'default' });
        actions.push({ action: 'hr_send_back', label: 'Send Back', variant: 'outline' });
        actions.push({ action: 'hr_extend', label: 'Extend', variant: 'outline' });
        actions.push({ action: 'hr_reject', label: 'Reject', variant: 'destructive' });
      }
      break;
    case 'PENDING_ACCOUNTS_APPROVAL':
      if (canAccountsApprove) {
        actions.push({ action: 'accounts_approve', label: 'Accounts Approve', variant: 'default' });
        actions.push({ action: 'accounts_request_revision', label: 'Request Revision', variant: 'outline' });
        actions.push({ action: 'accounts_reject', label: 'Reject', variant: 'destructive' });
      }
      break;
  }

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">No actions</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <form key={action.action} action={changeConfirmationStatusAction}>
          <input type="hidden" name="id" value={confirmation.id} />
          <input type="hidden" name="action" value={action.action} />
          <Button type="submit" variant={action.variant} size="sm">
            {action.label}
          </Button>
        </form>
      ))}
    </div>
  );
}

export function ConfirmationKpiCards({ counts }: { counts: Record<string, number> }) {
  const items = [
    { key: 'TOTAL', label: 'Total', value: Object.values(counts).reduce((sum, count) => sum + count, 0), tone: 'text-blue-600' },
    { key: 'DRAFT', label: 'Draft', value: counts.DRAFT ?? 0, tone: 'text-slate-700' },
    { key: 'PENDING_MANAGER_APPROVAL', label: 'Pending Manager', value: counts.PENDING_MANAGER_APPROVAL ?? 0, tone: 'text-amber-600' },
    { key: 'PENDING_HR_APPROVAL', label: 'Pending HR', value: counts.PENDING_HR_APPROVAL ?? 0, tone: 'text-orange-600' },
    { key: 'PENDING_ACCOUNTS_APPROVAL', label: 'Pending Accounts', value: counts.PENDING_ACCOUNTS_APPROVAL ?? 0, tone: 'text-yellow-600' },
    { key: 'CONFIRMED', label: 'Confirmed', value: counts.CONFIRMED ?? 0, tone: 'text-emerald-600' },
    { key: 'EXTENDED', label: 'Extended', value: counts.EXTENDED ?? 0, tone: 'text-indigo-600' },
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

export function ConfirmationTable({
  confirmations,
  canSubmit,
  canHrApprove,
  canAccountsApprove,
  canManagerApprove,
}: {
  confirmations: ConfirmationRecord[];
  canSubmit: boolean;
  canHrApprove: boolean;
  canAccountsApprove: boolean;
  canManagerApprove: boolean;
}) {
  if (confirmations.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground">
        No confirmation records found. Create a new confirmation request to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {confirmations.map((confirmation) => {
        const employeeName = confirmation.employee
          ? `${confirmation.employee.firstName} ${confirmation.employee.lastName}`
          : 'Unknown employee';

        return (
          <div
            key={confirmation.id}
            className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[1.1fr_1.5fr_1fr_1.2fr_1.2fr_1.2fr_1.6fr]"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmation #</p>
              <p className="text-sm font-semibold text-primary">{confirmation.confirmationNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</p>
              <p className="text-sm font-semibold">{employeeName}</p>
              <p className="text-xs text-muted-foreground">{confirmation.employee?.code ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
              <p className="text-sm">{CONFIRMATION_TYPE_LABELS[confirmation.confirmationType]}</p>
              <p className="text-xs text-muted-foreground">
                {confirmation.salaryRevisionRequired ? 'Salary revision' : 'No salary change'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Salary</p>
              <p className="text-sm">{formatMoney(confirmation.currentBasicSalary)}</p>
              <p className="text-xs text-muted-foreground">Gross {formatMoney(confirmation.currentGrossSalary)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revised Salary</p>
              <p className="text-sm">{formatMoney(confirmation.newBasicSalary)}</p>
              <p className="text-xs text-muted-foreground">Gross {formatMoney(confirmation.newGrossSalary)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Effective Date</p>
              <p className="text-sm">{formatDate(confirmation.effectiveDate)}</p>
              <p className="text-xs text-muted-foreground">Probation end {formatDate(confirmation.probationEndDate)}</p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(confirmation.status)}>
                  {CONFIRMATION_STATUS_LABELS[confirmation.status] ?? confirmation.status}
                </Badge>
                {['DRAFT', 'SENT_BACK'].includes(confirmation.status) && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/hr/confirmations?edit=${confirmation.id}`}>Edit</Link>
                  </Button>
                )}
              </div>
              {confirmation.benefitsRevision && (
                <p className="text-xs text-muted-foreground">Benefits: {confirmation.benefitsRevision}</p>
              )}
              <ConfirmationStatusActions
                confirmation={confirmation}
                canSubmit={canSubmit}
                canHrApprove={canHrApprove}
                canAccountsApprove={canAccountsApprove}
                canManagerApprove={canManagerApprove}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
