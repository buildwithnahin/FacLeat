'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  changeResignationStatusAction,
  createResignationAction,
  type ResignationFormState,
  updateResignationAction,
} from '@/server/actions/resignations';
import {
  RESIGNATION_STATUS_LABELS,
  RESIGNATION_TYPES,
  RESIGNATION_TYPE_LABELS,
} from '@/server/validators/resignations';

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

type EmployeeResignationDetail = {
  employeeLabel: string;
  employeeId: string;
  branch: string;
  department: string;
  designation: string;
  reportingManager: string;
  employmentType: string;
  joiningDate: string;
  confirmationDate: string;
  currentStatus: string;
};

type ResignationRecord = {
  id: string;
  resignationNumber: string;
  resignationType: string;
  resignationDate: string;
  lastWorkingDate: string;
  noticeRequired: boolean;
  noticePeriodDays: number;
  noticeServedDays: number;
  noticeWaived: boolean;
  buyoutAmount: string;
  reason: string;
  employeeRemarks: string | null;
  attachmentUrl: string | null;
  managerPerformance: string | null;
  currentProjects: string | null;
  handoverStatus: string | null;
  replacementNeeded: boolean | null;
  assetsReturned: boolean | null;
  managerRecommendation: string | null;
  attendanceVerified: boolean | null;
  leaveBalanceVerified: boolean | null;
  noticePeriodVerified: boolean | null;
  documentsVerified: boolean | null;
  policyVerified: boolean | null;
  pendingSalary: string;
  leaveEncashment: string;
  bonus: string;
  overtime: string;
  loanDeduction: string;
  advanceDeduction: string;
  taxDeduction: string;
  gratuity: string;
  finalPayable: string;
  settlementRequired: boolean;
  status: string;
  managerReviewStatus: string;
  hrReviewStatus: string;
  accountsReviewStatus: string;
  exitClearanceId?: string | null;
  employee: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
  } | null;
};

interface ResignationFormProps {
  mode: 'create' | 'edit';
  employees: SelectOption[];
  employeeDetails: Record<string, EmployeeResignationDetail>;
  initial?: ResignationRecord;
}

export function ResignationForm({ mode, employees, employeeDetails, initial }: ResignationFormProps) {
  const action = mode === 'create' ? createResignationAction : updateResignationAction;
  const [state, formAction, pending] = useActionState<ResignationFormState, FormData>(action, undefined);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initial?.employee?.id ?? '');
  const currentEmp = selectedEmployeeId ? employeeDetails[selectedEmployeeId] : null;

  const noticeRemaining = useMemo(() => {
    const required = Number(initial?.noticePeriodDays ?? 0);
    const served = Number(initial?.noticeServedDays ?? 0);
    return Math.max(required - served, 0);
  }, [initial?.noticePeriodDays, initial?.noticeServedDays]);

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}

      <Section title="Employee Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 xl:col-span-2">
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
          </div>
          <ReadOnlyField label="Employee ID" value={currentEmp?.employeeId ?? '-'} />
          <ReadOnlyField label="Current Status" value={currentEmp?.currentStatus ?? '-'} />
          <ReadOnlyField label="Branch" value={currentEmp?.branch ?? '-'} />
          <ReadOnlyField label="Department" value={currentEmp?.department ?? '-'} />
          <ReadOnlyField label="Designation" value={currentEmp?.designation ?? '-'} />
          <ReadOnlyField label="Reporting Manager" value={currentEmp?.reportingManager ?? '-'} />
          <ReadOnlyField label="Employment Type" value={currentEmp?.employmentType ?? '-'} />
          <ReadOnlyField label="Joining Date" value={currentEmp?.joiningDate ?? '-'} />
          <ReadOnlyField label="Confirmation Date" value={currentEmp?.confirmationDate ?? '-'} />
        </div>
      </Section>

      <Section title="Resignation Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyField label="Resignation No" value={initial?.resignationNumber ?? 'Auto after save'} />
          <Field label="Resignation Date" name="resignationDate" type="date" required defaultValue={toDateInput(initial?.resignationDate)} errors={state?.fieldErrors?.resignationDate} />
          <Field label="Last Working Date" name="lastWorkingDate" type="date" required defaultValue={toDateInput(initial?.lastWorkingDate)} errors={state?.fieldErrors?.lastWorkingDate} />
          <div className="space-y-2">
            <Label htmlFor="resignationType">
              Resignation Type <span className="text-destructive">*</span>
            </Label>
            <select id="resignationType" name="resignationType" defaultValue={initial?.resignationType ?? 'VOLUNTARY'} className={selectClass}>
              {RESIGNATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {RESIGNATION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextAreaField label="Reason for Resignation" name="reason" required defaultValue={initial?.reason ?? ''} errors={state?.fieldErrors?.reason} />
          <TextAreaField label="Employee Remarks" name="employeeRemarks" defaultValue={initial?.employeeRemarks ?? ''} />
        </div>
        <div className="mt-4">
          <Field label="Attachment URL" name="attachmentUrl" placeholder="Optional resignation letter path or URL" defaultValue={initial?.attachmentUrl ?? ''} />
        </div>
      </Section>

      <Section title="Notice Period">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SelectYesNo label="Notice Required" name="noticeRequired" defaultValue={initial?.noticeRequired ? 'yes' : 'no'} />
          <Field label="Notice Period Days" name="noticePeriodDays" type="number" required defaultValue={String(initial?.noticePeriodDays ?? 0)} />
          <Field label="Notice Served Days" name="noticeServedDays" type="number" defaultValue={String(initial?.noticeServedDays ?? 0)} />
          <SelectYesNo label="Notice Waived" name="noticeWaived" defaultValue={initial?.noticeWaived ? 'yes' : 'no'} />
          <Field label="Buyout Amount" name="buyoutAmount" type="number" step="0.01" defaultValue={initial?.buyoutAmount ?? ''} errors={state?.fieldErrors?.buyoutAmount} />
          <ReadOnlyField label="Remaining Days" value={String(noticeRemaining)} />
        </div>
      </Section>

      <Section title="Manager Evaluation">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextAreaField label="Performance" name="managerPerformance" defaultValue={initial?.managerPerformance ?? ''} />
          <TextAreaField label="Current Projects" name="currentProjects" defaultValue={initial?.currentProjects ?? ''} />
          <TextAreaField label="Handover Status" name="handoverStatus" defaultValue={initial?.handoverStatus ?? ''} />
          <TextAreaField label="Recommendation" name="managerRecommendation" defaultValue={initial?.managerRecommendation ?? ''} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SelectYesNo label="Replacement Needed" name="replacementNeeded" defaultValue={initial?.replacementNeeded ? 'yes' : 'no'} />
          <SelectYesNo label="Assets Returned" name="assetsReturned" defaultValue={initial?.assetsReturned ? 'yes' : 'no'} />
        </div>
      </Section>

      <Section title="HR Review">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SelectYesNo label="Attendance Verified" name="attendanceVerified" defaultValue={initial?.attendanceVerified ? 'yes' : 'no'} />
          <SelectYesNo label="Leave Balance Verified" name="leaveBalanceVerified" defaultValue={initial?.leaveBalanceVerified ? 'yes' : 'no'} />
          <SelectYesNo label="Notice Period Verified" name="noticePeriodVerified" defaultValue={initial?.noticePeriodVerified ? 'yes' : 'no'} />
          <SelectYesNo label="Documents Verified" name="documentsVerified" defaultValue={initial?.documentsVerified ? 'yes' : 'no'} />
          <SelectYesNo label="Policy Verified" name="policyVerified" defaultValue={initial?.policyVerified ? 'yes' : 'no'} />
        </div>
      </Section>

      <Section title="Financial Settlement">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Pending Salary" name="pendingSalary" type="number" step="0.01" defaultValue={initial?.pendingSalary ?? '0'} />
          <Field label="Leave Encashment" name="leaveEncashment" type="number" step="0.01" defaultValue={initial?.leaveEncashment ?? '0'} />
          <Field label="Bonus" name="bonus" type="number" step="0.01" defaultValue={initial?.bonus ?? '0'} />
          <Field label="Overtime" name="overtime" type="number" step="0.01" defaultValue={initial?.overtime ?? '0'} />
          <Field label="Loan Deduction" name="loanDeduction" type="number" step="0.01" defaultValue={initial?.loanDeduction ?? '0'} />
          <Field label="Advance Deduction" name="advanceDeduction" type="number" step="0.01" defaultValue={initial?.advanceDeduction ?? '0'} />
          <Field label="Tax Deduction" name="taxDeduction" type="number" step="0.01" defaultValue={initial?.taxDeduction ?? '0'} />
          <Field label="Gratuity" name="gratuity" type="number" step="0.01" defaultValue={initial?.gratuity ?? '0'} />
          <ReadOnlyField label="Final Payable" value={formatMoney(initial?.finalPayable ?? 0)} />
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : mode === 'edit' ? 'Update Resignation' : 'Save Draft'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/hr/resignations">Cancel</Link>
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}

function resignationStatusBadgeVariant(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'success' as const;
    case 'REJECTED':
      return 'destructive' as const;
    case 'PENDING_MANAGER_APPROVAL':
    case 'PENDING_HR_APPROVAL':
    case 'PENDING_ACCOUNTS_APPROVAL':
    case 'PENDING_EXIT_CLEARANCE':
      return 'warning' as const;
    default:
      return 'outline' as const;
  }
}

function ResignationStatusActions({
  record,
  canHrWrite,
  canManagerApprove,
  canAccountsApprove,
}: {
  record: ResignationRecord;
  canHrWrite: boolean;
  canManagerApprove: boolean;
  canAccountsApprove: boolean;
}) {
  const actions: Array<{ action: string; label: string; variant: 'default' | 'destructive' | 'outline' }> = [];

  if (['DRAFT', 'WITHDRAWN'].includes(record.status) && canHrWrite) {
    actions.push({ action: 'submit', label: 'Submit', variant: 'default' });
    actions.push({ action: 'cancel', label: 'Cancel', variant: 'outline' });
  }
  if (record.status === 'PENDING_MANAGER_APPROVAL' && canManagerApprove) {
    actions.push({ action: 'manager_approve', label: 'Approve', variant: 'default' });
    actions.push({ action: 'manager_send_back', label: 'Send Back', variant: 'outline' });
    actions.push({ action: 'manager_reject', label: 'Reject', variant: 'destructive' });
  }
  if (record.status === 'PENDING_HR_APPROVAL' && canHrWrite) {
    actions.push({ action: 'hr_approve', label: 'HR Approve', variant: 'default' });
    actions.push({ action: 'hr_hold', label: 'Hold', variant: 'outline' });
    actions.push({ action: 'hr_reject', label: 'Reject', variant: 'destructive' });
  }
  if (record.status === 'PENDING_ACCOUNTS_APPROVAL' && canAccountsApprove) {
    actions.push({ action: 'accounts_approve', label: 'Approve Settlement', variant: 'default' });
    actions.push({ action: 'accounts_request_correction', label: 'Request Correction', variant: 'outline' });
    actions.push({ action: 'accounts_reject', label: 'Reject Settlement', variant: 'destructive' });
  }
  if (['PENDING_EXIT_CLEARANCE', 'COMPLETED'].includes(record.status) && canHrWrite) {
    actions.push({ action: 'generate_acceptance_letter', label: 'Acceptance Letter', variant: 'outline' });
    actions.push({ action: 'generate_experience_letter', label: 'Experience Letter', variant: 'outline' });
    actions.push({ action: 'generate_relieving_letter', label: 'Relieving Letter', variant: 'outline' });
  }
  if (record.status === 'COMPLETED' && canHrWrite) {
    actions.push({ action: 'archive_employee', label: 'Archive Employee', variant: 'outline' });
  }

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">No actions</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <form key={action.action} action={changeResignationStatusAction}>
          <input type="hidden" name="id" value={record.id} />
          <input type="hidden" name="action" value={action.action} />
          <Button type="submit" variant={action.variant} size="sm">
            {action.label}
          </Button>
        </form>
      ))}
    </div>
  );
}

export function ResignationKpiCards({ counts }: { counts: Record<string, number> }) {
  const items = [
    { key: 'TOTAL', label: 'Total', value: Object.values(counts).reduce((sum, count) => sum + count, 0), tone: 'text-blue-600' },
    { key: 'DRAFT', label: 'Draft', value: counts.DRAFT ?? 0, tone: 'text-slate-700' },
    { key: 'PENDING_MANAGER_APPROVAL', label: 'Pending Manager', value: counts.PENDING_MANAGER_APPROVAL ?? 0, tone: 'text-amber-600' },
    { key: 'PENDING_HR_APPROVAL', label: 'Pending HR', value: counts.PENDING_HR_APPROVAL ?? 0, tone: 'text-orange-600' },
    { key: 'PENDING_ACCOUNTS_APPROVAL', label: 'Pending Accounts', value: counts.PENDING_ACCOUNTS_APPROVAL ?? 0, tone: 'text-yellow-600' },
    { key: 'PENDING_EXIT_CLEARANCE', label: 'Exit Clearance', value: counts.PENDING_EXIT_CLEARANCE ?? 0, tone: 'text-indigo-600' },
    { key: 'COMPLETED', label: 'Completed', value: counts.COMPLETED ?? 0, tone: 'text-emerald-600' },
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

export function ResignationTable({
  records,
  canHrWrite,
  canManagerApprove,
  canAccountsApprove,
}: {
  records: ResignationRecord[];
  canHrWrite: boolean;
  canManagerApprove: boolean;
  canAccountsApprove: boolean;
}) {
  if (records.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground">
        No resignation records found. Create a resignation request to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {records.map((record) => {
        const employeeName = record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : 'Unknown employee';

        return (
          <div
            key={record.id}
            className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[1.1fr_1.5fr_1fr_1fr_1fr_1.6fr]"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resignation No</p>
              <p className="text-sm font-semibold text-primary">{record.resignationNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</p>
              <p className="text-sm font-semibold">{employeeName}</p>
              <p className="text-xs text-muted-foreground">{record.employee?.code ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
              <p className="text-sm">{RESIGNATION_TYPE_LABELS[record.resignationType]}</p>
              <p className="text-xs text-muted-foreground">{formatDate(record.resignationDate)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Working Date</p>
              <p className="text-sm">{formatDate(record.lastWorkingDate)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Final Payable</p>
              <p className="text-sm">{formatMoney(record.finalPayable)}</p>
              <p className="text-xs text-muted-foreground">{record.settlementRequired ? 'Accounts required' : 'No accounts step'}</p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={resignationStatusBadgeVariant(record.status)}>
                  {RESIGNATION_STATUS_LABELS[record.status] ?? record.status}
                </Badge>
                {['DRAFT', 'WITHDRAWN'].includes(record.status) && canHrWrite && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/hr/resignations?edit=${record.id}`}>Edit</Link>
                  </Button>
                )}
                {record.status === 'PENDING_EXIT_CLEARANCE' && record.exitClearanceId && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/hr/exit-clearance?id=${record.exitClearanceId}`}>Open Exit Clearance</Link>
                  </Button>
                )}
              </div>
              <ResignationStatusActions
                record={record}
                canHrWrite={canHrWrite}
                canManagerApprove={canManagerApprove}
                canAccountsApprove={canAccountsApprove}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-4 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  errors,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  errors?: string[] | undefined;
  step?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} step={step} placeholder={placeholder} />
      {errors?.[0] && <p className="text-xs text-destructive">{errors[0]}</p>}
    </div>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  required,
  errors,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  errors?: string[] | undefined;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <textarea
        id={name}
        name={name}
        rows={3}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {errors?.[0] && <p className="text-xs text-destructive">{errors[0]}</p>}
    </div>
  );
}

function SelectYesNo({
  label,
  name,
  defaultValue = 'no',
}: {
  label: string;
  name: string;
  defaultValue?: 'yes' | 'no';
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className={selectClass}>
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </select>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
