'use client';

import Link from 'next/link';
import { useActionState, useMemo, useRef, useState } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LeavePolicyFormState } from '@/server/actions/leave-policies';
import {
  createLeavePolicyAction,
  updateLeavePolicyAction,
} from '@/server/actions/leave-policies';
import {
  LEAVE_ACCRUAL_METHODS,
  LEAVE_PAYROLL_IMPACTS,
  LEAVE_POLICY_STATUSES,
} from '@/server/validators/leave-policies';

type EmployeeOption = {
  id: string;
  code: string;
  name: string;
  branchLabel: string;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
};

type RuleValue = {
  leaveType: string;
  leaveCode: string;
  paidLeave: boolean;
  entitledDays: string;
  isUnlimited: boolean;
  accrualMethod: string;
  minimumServiceMonths: string;
  maxLeavePerRequest: string;
  maxLeavePerMonth: string;
  halfDayAllowed: boolean;
  attachmentRequired: boolean;
  reasonRequired: boolean;
  allowNegativeBalance: boolean;
  includeWeekend: boolean;
  includeHoliday: boolean;
  sandwichRuleApplicable: boolean;
  carryForwardAllowed: boolean;
  maxCarryForwardDays: string;
  encashmentAllowed: boolean;
  maxEncashmentDays: string;
  payrollImpact: string;
  status: string;
};

type PolicyValue = {
  id: string;
  policyCode: string;
  policyName: string;
  branchId: string | null;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
  employeeCategory: string | null;
  gender: string | null;
  grade: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: string;
  description: string | null;
  approvalRequired: boolean;
  managerApprovalRequired: boolean;
  hrApprovalRequired: boolean;
  accountsApprovalRequired: boolean;
  autoApproveAllowed: boolean;
  hrCanOverrideBalance: boolean;
  allowProbationEmployees: boolean;
  carryForwardAllowed: boolean;
  maxCarryForwardDays: number | null;
  carryForwardExpiryMonth: number | null;
  carryForwardExpiryDay: number | null;
  encashmentAllowed: boolean;
  maxEncashmentDays: number | null;
  autoClosing: boolean;
  payrollImpactDefault: string;
  rules: Array<{
    leaveType: string;
    leaveCode: string;
    paidLeave: boolean;
    entitledDays: number | null;
    isUnlimited: boolean;
    accrualMethod: string;
    minimumServiceMonths: number | null;
    maxLeavePerRequest: number | null;
    maxLeavePerMonth: number | null;
    halfDayAllowed: boolean;
    attachmentRequired: boolean;
    reasonRequired: boolean;
    allowNegativeBalance: boolean;
    includeWeekend: boolean;
    includeHoliday: boolean;
    sandwichRuleApplicable: boolean;
    carryForwardAllowed: boolean;
    maxCarryForwardDays: number | null;
    encashmentAllowed: boolean;
    maxEncashmentDays: number | null;
    payrollImpact: string;
    status: string;
  }>;
  assignedEmployees: Array<{ id: string }>;
};

const LEAVE_TYPE_OPTIONS = [
  'CASUAL',
  'SICK',
  'EARNED',
  'ANNUAL',
  'MATERNITY',
  'PATERNITY',
  'EMERGENCY',
  'UNPAID',
  'COMPENSATORY',
  'SPECIAL',
  'FESTIVAL',
  'OTHER',
] as const;

function buildDefaultRule(): RuleValue {
  return {
    leaveType: 'CASUAL',
    leaveCode: 'CASUAL',
    paidLeave: true,
    entitledDays: '10',
    isUnlimited: false,
    accrualMethod: 'YEARLY_ALLOCATION',
    minimumServiceMonths: '',
    maxLeavePerRequest: '',
    maxLeavePerMonth: '',
    halfDayAllowed: true,
    attachmentRequired: false,
    reasonRequired: true,
    allowNegativeBalance: false,
    includeWeekend: false,
    includeHoliday: false,
    sandwichRuleApplicable: false,
    carryForwardAllowed: false,
    maxCarryForwardDays: '',
    encashmentAllowed: false,
    maxEncashmentDays: '',
    payrollImpact: 'PAID_LEAVE',
    status: 'ACTIVE',
  };
}

function mapInitialRule(rule: PolicyValue['rules'][number]): RuleValue {
  return {
    leaveType: rule.leaveType,
    leaveCode: rule.leaveCode,
    paidLeave: rule.paidLeave,
    entitledDays: rule.entitledDays == null ? '' : String(rule.entitledDays),
    isUnlimited: rule.isUnlimited,
    accrualMethod: rule.accrualMethod,
    minimumServiceMonths: rule.minimumServiceMonths == null ? '' : String(rule.minimumServiceMonths),
    maxLeavePerRequest: rule.maxLeavePerRequest == null ? '' : String(rule.maxLeavePerRequest),
    maxLeavePerMonth: rule.maxLeavePerMonth == null ? '' : String(rule.maxLeavePerMonth),
    halfDayAllowed: rule.halfDayAllowed,
    attachmentRequired: rule.attachmentRequired,
    reasonRequired: rule.reasonRequired,
    allowNegativeBalance: rule.allowNegativeBalance,
    includeWeekend: rule.includeWeekend,
    includeHoliday: rule.includeHoliday,
    sandwichRuleApplicable: rule.sandwichRuleApplicable,
    carryForwardAllowed: rule.carryForwardAllowed,
    maxCarryForwardDays: rule.maxCarryForwardDays == null ? '' : String(rule.maxCarryForwardDays),
    encashmentAllowed: rule.encashmentAllowed,
    maxEncashmentDays: rule.maxEncashmentDays == null ? '' : String(rule.maxEncashmentDays),
    payrollImpact: rule.payrollImpact,
    status: rule.status,
  };
}

function CheckboxField({
  name,
  label,
  checked,
  defaultChecked,
  onChange,
}: {
  name?: string;
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
      <input
        type="checkbox"
        name={name}
        checked={onChange ? checked : undefined}
        defaultChecked={onChange ? undefined : defaultChecked}
        onChange={(event) => onChange?.(event.target.checked)}
        value="true"
        className="h-4 w-4 rounded border-slate-300"
      />
      <span>{label}</span>
    </label>
  );
}

export function LeavePolicyForm({
  mode,
  initial,
  branches,
  departments,
  designations,
  employmentTypes,
  employees,
  path,
}: {
  mode: 'create' | 'edit';
  initial?: PolicyValue | null;
  branches: Array<{ id: string; label: string }>;
  departments: string[];
  designations: string[];
  employmentTypes: string[];
  employees: EmployeeOption[];
  path: string;
}) {
  const action = mode === 'create' ? createLeavePolicyAction : updateLeavePolicyAction;
  const [state, formAction, pending] = useActionState<LeavePolicyFormState, FormData>(action, undefined);
  const [status, setStatus] = useState(initial?.status ?? 'DRAFT');
  const statusInputRef = useRef<HTMLInputElement>(null);
  const [rules, setRules] = useState<RuleValue[]>(
    initial?.rules.length ? initial.rules.map(mapInitialRule) : [buildDefaultRule()],
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    initial?.assignedEmployees.map((employee) => employee.id) ?? [],
  );

  const selectedSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);

  const rulesJson = JSON.stringify(
    rules.map((rule) => ({
      ...rule,
      entitledDays: rule.entitledDays === '' ? null : Number(rule.entitledDays),
      minimumServiceMonths: rule.minimumServiceMonths === '' ? null : Number(rule.minimumServiceMonths),
      maxLeavePerRequest: rule.maxLeavePerRequest === '' ? null : Number(rule.maxLeavePerRequest),
      maxLeavePerMonth: rule.maxLeavePerMonth === '' ? null : Number(rule.maxLeavePerMonth),
      maxCarryForwardDays: rule.maxCarryForwardDays === '' ? null : Number(rule.maxCarryForwardDays),
      maxEncashmentDays: rule.maxEncashmentDays === '' ? null : Number(rule.maxEncashmentDays),
    })),
  );

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
  };

  const updateRule = (index: number, patch: Partial<RuleValue>) => {
    setRules((current) => current.map((rule, idx) => (idx === index ? { ...rule, ...patch } : rule)));
  };

  const removeRule = (index: number) => {
    setRules((current) => (current.length === 1 ? current : current.filter((_, idx) => idx !== index)));
  };

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' ? <input type="hidden" name="id" value={initial?.id} /> : null}
      <input ref={statusInputRef} type="hidden" name="status" value={status} readOnly />
      <input type="hidden" name="rules" value={rulesJson} />
      <input type="hidden" name="assignedEmployeeIds" value={JSON.stringify(selectedEmployeeIds)} />

      <Card>
        <CardHeader>
          <CardTitle>Policy Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Policy Name" name="policyName" required defaultValue={initial?.policyName ?? ''} />
          <Field label="Policy Code" name="policyCode" required defaultValue={initial?.policyCode ?? ''} />
          <SelectField label="Branch" name="branchId" defaultValue={initial?.branchId ?? ''} options={branches} />
          <SelectField
            label="Status"
            name="_statusView"
            value={status}
            onChange={setStatus}
            options={LEAVE_POLICY_STATUSES.map((value) => ({ value, label: value }))}
          />
          <SelectField
            label="Department"
            name="department"
            defaultValue={initial?.department ?? ''}
            options={departments.map((value) => ({ value, label: value }))}
          />
          <SelectField
            label="Designation"
            name="designation"
            defaultValue={initial?.designation ?? ''}
            options={designations.map((value) => ({ value, label: value }))}
          />
          <SelectField
            label="Employment Type"
            name="employmentType"
            defaultValue={initial?.employmentType ?? ''}
            options={employmentTypes.map((value) => ({ value, label: value }))}
          />
          <Field label="Employee Category" name="employeeCategory" defaultValue={initial?.employeeCategory ?? ''} />
          <Field label="Gender" name="gender" defaultValue={initial?.gender ?? ''} />
          <Field label="Grade" name="grade" defaultValue={initial?.grade ?? ''} />
          <Field label="Effective From" name="effectiveFrom" type="date" required defaultValue={initial?.effectiveFrom ?? ''} />
          <Field label="Effective To" name="effectiveTo" type="date" defaultValue={initial?.effectiveTo ?? ''} />
          <div className="md:col-span-2 xl:col-span-4">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={initial?.description ?? ''} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Leave Rules Table</CardTitle>
          <Button type="button" variant="outline" onClick={() => setRules((current) => [...current, buildDefaultRule()])}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Leave Type
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.map((rule, index) => (
            <div key={`${rule.leaveType}-${index}`} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-semibold">Rule {index + 1}</h4>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeRule(index)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SelectField
                  label="Leave Type"
                  name={`rule-${index}-type`}
                  value={rule.leaveType}
                  onChange={(value) =>
                    updateRule(index, {
                      leaveType: value,
                      leaveCode: value,
                      payrollImpact: value === 'UNPAID' ? 'UNPAID_LEAVE_DEDUCTION' : rule.payrollImpact,
                    })
                  }
                  options={LEAVE_TYPE_OPTIONS.map((value) => ({ value, label: value.replaceAll('_', ' ') }))}
                />
                <Field label="Leave Code" name={`rule-${index}-code`} value={rule.leaveCode} onChange={(value) => updateRule(index, { leaveCode: value })} />
                <Field
                  label="Entitled Days"
                  name={`rule-${index}-entitledDays`}
                  type="number"
                  value={rule.entitledDays}
                  disabled={rule.isUnlimited}
                  onChange={(value) => updateRule(index, { entitledDays: value })}
                />
                <SelectField
                  label="Accrual Method"
                  name={`rule-${index}-accrual`}
                  value={rule.accrualMethod}
                  onChange={(value) => updateRule(index, { accrualMethod: value })}
                  options={LEAVE_ACCRUAL_METHODS.map((value) => ({ value, label: value.replaceAll('_', ' ') }))}
                />
                <Field
                  label="Min Service Months"
                  name={`rule-${index}-service`}
                  type="number"
                  value={rule.minimumServiceMonths}
                  onChange={(value) => updateRule(index, { minimumServiceMonths: value })}
                />
                <Field
                  label="Max Leave / Request"
                  name={`rule-${index}-request`}
                  type="number"
                  value={rule.maxLeavePerRequest}
                  onChange={(value) => updateRule(index, { maxLeavePerRequest: value })}
                />
                <Field
                  label="Max Leave / Month"
                  name={`rule-${index}-month`}
                  type="number"
                  value={rule.maxLeavePerMonth}
                  onChange={(value) => updateRule(index, { maxLeavePerMonth: value })}
                />
                <SelectField
                  label="Payroll Impact"
                  name={`rule-${index}-payroll`}
                  value={rule.payrollImpact}
                  onChange={(value) => updateRule(index, { payrollImpact: value })}
                  options={LEAVE_PAYROLL_IMPACTS.map((value) => ({ value, label: value.replaceAll('_', ' ') }))}
                />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CheckboxField label="Paid Leave" checked={rule.paidLeave} onChange={(next) => updateRule(index, { paidLeave: next })} />
                <CheckboxField label="Unlimited" checked={rule.isUnlimited} onChange={(next) => updateRule(index, { isUnlimited: next, entitledDays: next ? '' : rule.entitledDays })} />
                <CheckboxField label="Half Day Allowed" checked={rule.halfDayAllowed} onChange={(next) => updateRule(index, { halfDayAllowed: next })} />
                <CheckboxField label="Attachment Required" checked={rule.attachmentRequired} onChange={(next) => updateRule(index, { attachmentRequired: next })} />
                <CheckboxField label="Reason Required" checked={rule.reasonRequired} onChange={(next) => updateRule(index, { reasonRequired: next })} />
                <CheckboxField label="Allow Negative Balance" checked={rule.allowNegativeBalance} onChange={(next) => updateRule(index, { allowNegativeBalance: next })} />
                <CheckboxField label="Include Weekend" checked={rule.includeWeekend} onChange={(next) => updateRule(index, { includeWeekend: next })} />
                <CheckboxField label="Include Holiday" checked={rule.includeHoliday} onChange={(next) => updateRule(index, { includeHoliday: next })} />
                <CheckboxField label="Sandwich Rule" checked={rule.sandwichRuleApplicable} onChange={(next) => updateRule(index, { sandwichRuleApplicable: next })} />
                <CheckboxField label="Carry Forward Allowed" checked={rule.carryForwardAllowed} onChange={(next) => updateRule(index, { carryForwardAllowed: next })} />
                <Field
                  label="Max Carry Forward Days"
                  name={`rule-${index}-carry`}
                  type="number"
                  value={rule.maxCarryForwardDays}
                  disabled={!rule.carryForwardAllowed}
                  onChange={(value) => updateRule(index, { maxCarryForwardDays: value })}
                />
                <CheckboxField label="Encashment Allowed" checked={rule.encashmentAllowed} onChange={(next) => updateRule(index, { encashmentAllowed: next })} />
                <Field
                  label="Max Encashment Days"
                  name={`rule-${index}-encash`}
                  type="number"
                  value={rule.maxEncashmentDays}
                  disabled={!rule.encashmentAllowed}
                  onChange={(value) => updateRule(index, { maxEncashmentDays: value })}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approval Rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <CheckboxField name="approvalRequired" label="Approval Required" defaultChecked={initial?.approvalRequired ?? true} />
            <CheckboxField name="managerApprovalRequired" label="Manager Approval Required" defaultChecked={initial?.managerApprovalRequired ?? true} />
            <CheckboxField name="hrApprovalRequired" label="HR Approval Required" defaultChecked={initial?.hrApprovalRequired ?? true} />
            <CheckboxField name="accountsApprovalRequired" label="Accounts Approval Required" defaultChecked={initial?.accountsApprovalRequired ?? false} />
            <CheckboxField name="autoApproveAllowed" label="Auto Approve Allowed" defaultChecked={initial?.autoApproveAllowed ?? false} />
            <CheckboxField name="hrCanOverrideBalance" label="HR Can Override Balance" defaultChecked={initial?.hrCanOverrideBalance ?? true} />
            <CheckboxField name="allowProbationEmployees" label="Allow Probation Employees" defaultChecked={initial?.allowProbationEmployees ?? false} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Year End Rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <CheckboxField name="carryForwardAllowed" label="Carry Forward Allowed" defaultChecked={initial?.carryForwardAllowed ?? false} />
            <Field label="Max Carry Forward Days" name="maxCarryForwardDays" type="number" defaultValue={initial?.maxCarryForwardDays == null ? '' : String(initial.maxCarryForwardDays)} />
            <Field label="Carry Forward Expiry Month" name="carryForwardExpiryMonth" type="number" defaultValue={initial?.carryForwardExpiryMonth == null ? '' : String(initial.carryForwardExpiryMonth)} />
            <Field label="Carry Forward Expiry Day" name="carryForwardExpiryDay" type="number" defaultValue={initial?.carryForwardExpiryDay == null ? '' : String(initial.carryForwardExpiryDay)} />
            <CheckboxField name="encashmentAllowed" label="Encashment Allowed" defaultChecked={initial?.encashmentAllowed ?? false} />
            <Field label="Max Encashment Days" name="maxEncashmentDays" type="number" defaultValue={initial?.maxEncashmentDays == null ? '' : String(initial.maxEncashmentDays)} />
            <CheckboxField name="autoClosing" label="Auto Closing" defaultChecked={initial?.autoClosing ?? false} />
            <SelectField
              label="Default Payroll Impact"
              name="payrollImpactDefault"
              defaultValue={initial?.payrollImpactDefault ?? 'NO_PAYROLL_IMPACT'}
              options={LEAVE_PAYROLL_IMPACTS.map((value) => ({ value, label: value.replaceAll('_', ' ') }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assign to Employees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Manual assignment is always supported. If you also use Employee Category, Gender, or Grade, assign employees manually until those fields exist in the employee master.
          </p>
          <div className="grid max-h-72 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-2">
            {employees.map((employee) => (
              <label key={employee.id} className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={selectedSet.has(employee.id)}
                  onChange={() => toggleEmployee(employee.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="block font-medium">{employee.code} · {employee.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {employee.branchLabel} · {employee.department || 'No department'} · {employee.employmentType || 'No type'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {(state?.error || state?.fieldErrors?.rules?.[0]) ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state?.error || state?.fieldErrors?.rules?.[0]}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={pending}
          onClick={() => {
            if (statusInputRef.current) statusInputRef.current.value = 'DRAFT';
            setStatus('DRAFT');
          }}
        >
          {pending ? 'Saving...' : 'Save Draft'}
        </Button>
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (statusInputRef.current) statusInputRef.current.value = 'ACTIVE';
            setStatus('ACTIVE');
          }}
        >
          {mode === 'edit' ? 'Update Policy' : 'Activate Policy'}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href={path}>Cancel</Link>
        </Button>
        {state?.success ? <span className="self-center text-sm text-emerald-600">Saved successfully.</span> : null}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  value,
  disabled,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        value={value}
        disabled={disabled}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
