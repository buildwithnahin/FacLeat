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
import { createLeavePolicyAction, updateLeavePolicyAction } from '@/server/actions/leave-policies';
import { LEAVE_ACCRUAL_METHODS, LEAVE_POLICY_STATUSES } from '@/server/validators/leave-policies';

type EmployeeOption = {
  id: string;
  code: string;
  name: string;
  branchId: string;
  branchLabel: string;
  department: string | null;
  designation: string | null;
  employmentType: string | null;
};

type LeaveTypeOption = {
  id: string;
  code: string;
  name: string;
  paidLeave: boolean;
  annualEntitlement: number | null;
  maxConsecutiveDays: number | null;
  allowHalfDay: boolean;
  attachmentRequired: boolean;
  allowNegativeBalance: boolean;
  holidayIncluded: boolean;
  weekendIncluded: boolean;
  carryForwardAllowed: boolean;
  maximumCarryForwardDays: number | null;
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
    payrollImpact: string;
    status: string;
  }>;
  assignedEmployees: Array<{ id: string }>;
};

type ApprovalFlow = 'MANAGER_THEN_HR' | 'HR_ONLY' | 'AUTO_APPROVE';

function buildDefaultRule(leaveType?: LeaveTypeOption): RuleValue {
  const code = leaveType?.code ?? 'CASUAL';
  const paidLeave = leaveType?.paidLeave ?? true;
  return {
    leaveType: code,
    leaveCode: code,
    paidLeave,
    entitledDays: leaveType?.annualEntitlement == null ? '' : String(leaveType.annualEntitlement),
    isUnlimited: false,
    accrualMethod: 'YEARLY_ALLOCATION',
    minimumServiceMonths: '',
    maxLeavePerRequest: leaveType?.maxConsecutiveDays == null ? '' : String(leaveType.maxConsecutiveDays),
    maxLeavePerMonth: '',
    halfDayAllowed: leaveType?.allowHalfDay ?? true,
    attachmentRequired: leaveType?.attachmentRequired ?? false,
    reasonRequired: true,
    allowNegativeBalance: leaveType?.allowNegativeBalance ?? false,
    includeWeekend: leaveType?.weekendIncluded ?? false,
    includeHoliday: leaveType?.holidayIncluded ?? false,
    sandwichRuleApplicable: false,
    carryForwardAllowed: leaveType?.carryForwardAllowed ?? false,
    maxCarryForwardDays: leaveType?.maximumCarryForwardDays == null ? '' : String(leaveType.maximumCarryForwardDays),
    payrollImpact: paidLeave ? 'PAID_LEAVE' : 'UNPAID_LEAVE_DEDUCTION',
    status: 'ACTIVE',
  };
}

function buildInitialRulesFromLeaveTypes(leaveTypes: LeaveTypeOption[]) {
  return leaveTypes.length ? leaveTypes.map((leaveType) => buildDefaultRule(leaveType)) : [buildDefaultRule()];
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
    payrollImpact: rule.payrollImpact,
    status: rule.status,
  };
}

function deriveApprovalFlow(initial?: PolicyValue | null): ApprovalFlow {
  if (!initial) return 'MANAGER_THEN_HR';
  if (!initial.approvalRequired || initial.autoApproveAllowed) return 'AUTO_APPROVE';
  if (!initial.managerApprovalRequired && initial.hrApprovalRequired) return 'HR_ONLY';
  return 'MANAGER_THEN_HR';
}

function monthlyAccrualPreview(rule: RuleValue) {
  if (rule.accrualMethod !== 'MONTHLY_ACCRUAL' || !rule.entitledDays || rule.isUnlimited) return '—';
  const yearly = Number(rule.entitledDays);
  if (!Number.isFinite(yearly)) return '—';
  return `${(yearly / 12).toFixed(2)} / month`;
}

function CheckboxField({
  name,
  label,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
}: {
  name?: string;
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}>
      <input
        type="checkbox"
        name={name}
        checked={onChange ? checked : undefined}
        defaultChecked={onChange ? undefined : defaultChecked}
        onChange={(event) => onChange?.(event.target.checked)}
        value="true"
        disabled={disabled}
        className="h-4 w-4 rounded border-slate-300"
      />
      <span>{label}</span>
    </label>
  );
}

function SectionHeader({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-900">
          {index}
        </div>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </CardHeader>
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
  leaveTypes,
  path,
}: {
  mode: 'create' | 'edit';
  initial?: PolicyValue | null;
  branches: Array<{ value: string; label: string }>;
  departments: string[];
  designations: string[];
  employmentTypes: string[];
  employees: EmployeeOption[];
  leaveTypes: LeaveTypeOption[];
  path: string;
}) {
  const action = mode === 'create' ? createLeavePolicyAction : updateLeavePolicyAction;
  const [state, formAction, pending] = useActionState<LeavePolicyFormState, FormData>(action, undefined);
  const [status, setStatus] = useState(initial?.status ?? 'DRAFT');
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow>(deriveApprovalFlow(initial));
  const [gender, setGender] = useState(initial?.gender ?? 'ALL');
  const [employmentType, setEmploymentType] = useState(initial?.employmentType ?? '');
  const [branchId, setBranchId] = useState(initial?.branchId ?? '');
  const [department, setDepartment] = useState(initial?.department ?? '');
  const [designation, setDesignation] = useState(initial?.designation ?? '');
  const [accountsApprovalRequired, setAccountsApprovalRequired] = useState(initial?.accountsApprovalRequired ?? false);
  const [hrCanOverrideBalance, setHrCanOverrideBalance] = useState(initial?.hrCanOverrideBalance ?? true);
  const statusInputRef = useRef<HTMLInputElement>(null);
  const leaveTypeMap = useMemo(() => new Map(leaveTypes.map((leaveType) => [leaveType.code, leaveType])), [leaveTypes]);
  const [rules, setRules] = useState<RuleValue[]>(
    initial?.rules.length ? initial.rules.map(mapInitialRule) : buildInitialRulesFromLeaveTypes(leaveTypes),
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(
    initial?.assignedEmployees.map((employee) => employee.id) ?? [],
  );

  const selectedSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);

  const availableLeaveTypes = leaveTypes.filter((leaveType) => !rules.some((rule) => rule.leaveType === leaveType.code));
  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (employmentType && employee.employmentType !== employmentType) return false;
        if (branchId && employee.branchId !== branchId) return false;
        if (department && employee.department !== department) return false;
        if (designation && employee.designation !== designation) return false;
        return true;
      }),
    [branchId, department, designation, employees, employmentType],
  );
  const applicabilityPreview = [employmentType || 'All employees', branchId ? branches.find((branch) => branch.value === branchId)?.label ?? '' : '', department, designation]
    .filter(Boolean)
    .join(' · ');

  const rulesJson = JSON.stringify(
    rules.map((rule) => ({
      ...rule,
      entitledDays: rule.entitledDays === '' ? null : Number(rule.entitledDays),
      minimumServiceMonths: rule.minimumServiceMonths === '' ? null : Number(rule.minimumServiceMonths),
      maxLeavePerRequest: rule.maxLeavePerRequest === '' ? null : Number(rule.maxLeavePerRequest),
      maxLeavePerMonth: rule.maxLeavePerMonth === '' ? null : Number(rule.maxLeavePerMonth),
      maxCarryForwardDays: rule.maxCarryForwardDays === '' ? null : Number(rule.maxCarryForwardDays),
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

  const applyLeaveTypeToRule = (index: number, code: string) => {
    const leaveType = leaveTypeMap.get(code);
    setRules((current) =>
      current.map((rule, idx) =>
        idx === index
          ? {
              ...buildDefaultRule(leaveType),
              leaveType: code,
              leaveCode: code,
              minimumServiceMonths: rule.minimumServiceMonths,
              maxLeavePerMonth: rule.maxLeavePerMonth,
            }
          : rule,
      ),
    );
  };

  const removeRule = (index: number) => {
    setRules((current) => (current.length === 1 ? current : current.filter((_, idx) => idx !== index)));
  };

  const selectAllVisibleEmployees = () => {
    setSelectedEmployeeIds((current) => Array.from(new Set([...current, ...filteredEmployees.map((employee) => employee.id)])));
  };

  const clearVisibleEmployees = () => {
    const visibleIds = new Set(filteredEmployees.map((employee) => employee.id));
    setSelectedEmployeeIds((current) => current.filter((id) => !visibleIds.has(id)));
  };

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' ? <input type="hidden" name="id" value={initial?.id} /> : null}
      <input ref={statusInputRef} type="hidden" name="status" value={status} readOnly />
      <input type="hidden" name="rules" value={rulesJson} />
      <input type="hidden" name="assignedEmployeeIds" value={JSON.stringify(selectedEmployeeIds)} />
      <input type="hidden" name="approvalRequired" value={approvalFlow === 'AUTO_APPROVE' ? 'false' : 'true'} />
      <input type="hidden" name="autoApproveAllowed" value={approvalFlow === 'AUTO_APPROVE' ? 'true' : 'false'} />

      <Card>
        <SectionHeader
          index="1"
          title="Basic Information"
          description="Create the policy shell with name, description, effective dates, and lifecycle status."
        />
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Policy Name" name="policyName" required defaultValue={initial?.policyName ?? ''} />
          <Field label="Policy Code" name="policyCode" required defaultValue={initial?.policyCode ?? ''} />
          <SelectField
            label="Status"
            name="_statusView"
            value={status}
            onChange={setStatus}
            options={LEAVE_POLICY_STATUSES.map((value) => ({ value, label: value }))}
          />
          <Field label="Effective From" name="effectiveFrom" type="date" required defaultValue={initial?.effectiveFrom ?? ''} />
          <Field label="Effective To" name="effectiveTo" type="date" defaultValue={initial?.effectiveTo ?? ''} />
          <div className="md:col-span-2 xl:col-span-4">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={initial?.description ?? ''} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          index="2"
          title="Applicable Employees"
          description="Define which employee group receives this policy before balances are generated."
        />
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Employment Type"
            name="employmentType"
            required
            value={employmentType}
            onChange={setEmploymentType}
            options={employmentTypes.map((value) => ({ value, label: value }))}
          />
          <SelectField label="Branch" name="branchId" value={branchId} onChange={setBranchId} options={branches} />
          <SelectField
            label="Department"
            name="department"
            value={department}
            onChange={setDepartment}
            options={departments.map((value) => ({ value, label: value }))}
          />
          <Field label="Section" name="employeeCategory" defaultValue={initial?.employeeCategory ?? ''} />
          <SelectField
            label="Designation"
            name="designation"
            value={designation}
            onChange={setDesignation}
            options={designations.map((value) => ({ value, label: value }))}
          />
          <Field label="Employee Grade" name="grade" defaultValue={initial?.grade ?? ''} />
          <RadioGroup
            label="Gender"
            name="gender"
            value={gender}
            onChange={setGender}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'MALE', label: 'Male' },
              { value: 'FEMALE', label: 'Female' },
            ]}
          />
          <CheckboxField
            name="allowProbationEmployees"
            label="Allow Probation Employees"
            defaultChecked={initial?.allowProbationEmployees ?? false}
          />
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-muted-foreground dark:border-slate-700 md:col-span-2 xl:col-span-4">
            Applicable to: {applicabilityPreview || 'All active employees'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          index="3"
          title="Leave Entitlements"
          description="This is the core of the policy. Define annual days, paid/unpaid behavior, and whether each leave type is active."
        />
        <CardContent className="space-y-4 pt-6">
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3">Leave Type</th>
                  <th className="px-4 py-3">Annual Days</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Allocation Method</th>
                  <th className="px-4 py-3">Monthly Accrual</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rules.map((rule, index) => (
                  <tr key={`${rule.leaveType}-${index}`}>
                    <td className="px-4 py-3">
                      <SelectField
                        label=""
                        name={`rule-${index}-type`}
                        value={rule.leaveType}
                        onChange={(value) => applyLeaveTypeToRule(index, value)}
                        hideLabel
                        options={leaveTypes.map((value) => ({ value: value.code, label: `${value.code} · ${value.name}` }))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Field
                        label=""
                        name={`rule-${index}-entitledDays`}
                        type="number"
                        hideLabel
                        value={rule.entitledDays}
                        disabled={rule.isUnlimited}
                        onChange={(value) => updateRule(index, { entitledDays: value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <CheckboxField label="Paid" checked={rule.paidLeave} onChange={(next) => updateRule(index, { paidLeave: next })} />
                    </td>
                    <td className="px-4 py-3">
                      <CheckboxField label="Active" checked={rule.status === 'ACTIVE'} onChange={(next) => updateRule(index, { status: next ? 'ACTIVE' : 'INACTIVE' })} />
                    </td>
                    <td className="px-4 py-3">
                      <SelectField
                        label=""
                        name={`rule-${index}-accrual`}
                        value={rule.accrualMethod}
                        onChange={(value) => updateRule(index, { accrualMethod: value })}
                        hideLabel
                        options={LEAVE_ACCRUAL_METHODS.map((value) => ({ value, label: value.replaceAll('_', ' ') }))}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{monthlyAccrualPreview(rule)}</td>
                    <td className="px-4 py-3">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeRule(index)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={availableLeaveTypes.length === 0}
            onClick={() =>
              setRules((current) => [...current, buildDefaultRule(availableLeaveTypes[0] ?? leaveTypes[0])])
            }
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {availableLeaveTypes.length === 0 ? 'All Leave Types Added' : 'Add Leave Type'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          index="4"
          title="Accrual, Carry Forward, Encashment, and Restrictions"
          description="Configure how balances behave after allocation and what limits apply during application."
        />
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h4 className="font-semibold">Carry Forward</h4>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CheckboxField name="carryForwardAllowed" label="Carry Forward Allowed" defaultChecked={initial?.carryForwardAllowed ?? false} />
              <Field label="Maximum Carry Forward" name="maxCarryForwardDays" type="number" defaultValue={initial?.maxCarryForwardDays == null ? '' : String(initial?.maxCarryForwardDays)} />
              <Field label="Carry Forward Expiry Month" name="carryForwardExpiryMonth" type="number" defaultValue={initial?.carryForwardExpiryMonth == null ? '' : String(initial?.carryForwardExpiryMonth)} />
              <Field label="Carry Forward Expiry Day" name="carryForwardExpiryDay" type="number" defaultValue={initial?.carryForwardExpiryDay == null ? '' : String(initial?.carryForwardExpiryDay)} />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Leave Type Restrictions</h4>
            <div className="grid gap-4">
              {rules.map((rule, index) => (
                <div key={`restriction-${rule.leaveType}-${index}`} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{rule.leaveType.replaceAll('_', ' ')}</div>
                      <div className="text-xs text-muted-foreground">Policy-specific limits and application behavior</div>
                    </div>
                    <CheckboxField label="Unlimited" checked={rule.isUnlimited} onChange={(next) => updateRule(index, { isUnlimited: next, entitledDays: next ? '' : rule.entitledDays })} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Maximum Consecutive Leave" name={`rule-${index}-request`} type="number" value={rule.maxLeavePerRequest} onChange={(value) => updateRule(index, { maxLeavePerRequest: value })} />
                    <Field label="Maximum Applications Per Month" name={`rule-${index}-month`} type="number" value={rule.maxLeavePerMonth} onChange={(value) => updateRule(index, { maxLeavePerMonth: value })} />
                    <Field label="Minimum Service Months" name={`rule-${index}-service`} type="number" value={rule.minimumServiceMonths} onChange={(value) => updateRule(index, { minimumServiceMonths: value })} />
                    <Field label="Leave Code" name={`rule-${index}-code`} value={rule.leaveCode} onChange={(value) => updateRule(index, { leaveCode: value })} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <CheckboxField label="Half Day Allowed" checked={rule.halfDayAllowed} onChange={(next) => updateRule(index, { halfDayAllowed: next })} />
                    <CheckboxField label="Attachment Required" checked={rule.attachmentRequired} onChange={(next) => updateRule(index, { attachmentRequired: next })} />
                    <CheckboxField label="Reason Required" checked={rule.reasonRequired} onChange={(next) => updateRule(index, { reasonRequired: next })} />
                    <CheckboxField label="Allow Negative Balance" checked={rule.allowNegativeBalance} onChange={(next) => updateRule(index, { allowNegativeBalance: next })} />
                    <CheckboxField label="Holiday Included" checked={rule.includeHoliday} onChange={(next) => updateRule(index, { includeHoliday: next })} />
                    <CheckboxField label="Weekend Included" checked={rule.includeWeekend} onChange={(next) => updateRule(index, { includeWeekend: next })} />
                    <CheckboxField label="Carry Forward Allowed" checked={rule.carryForwardAllowed} onChange={(next) => updateRule(index, { carryForwardAllowed: next })} />
                    <Field label="Carry Forward Limit" name={`rule-${index}-carry`} type="number" value={rule.maxCarryForwardDays} disabled={!rule.carryForwardAllowed} onChange={(value) => updateRule(index, { maxCarryForwardDays: value })} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          index="5"
          title="Approval Workflow"
          description="Choose how leave requests move for approval after employees submit them."
        />
        <CardContent className="space-y-4 pt-6">
          <RadioGroup
            label="Approval Flow"
            name="approvalFlow"
            value={approvalFlow}
            onChange={(value) => setApprovalFlow(value as ApprovalFlow)}
            options={[
              { value: 'MANAGER_THEN_HR', label: 'Manager -> HR' },
              { value: 'HR_ONLY', label: 'HR Only' },
              { value: 'AUTO_APPROVE', label: 'Auto Approve' },
            ]}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CheckboxField label="Approval Required" checked={approvalFlow !== 'AUTO_APPROVE'} disabled />
            <CheckboxField label="Auto Approve" checked={approvalFlow === 'AUTO_APPROVE'} disabled />
            <CheckboxField
              name="accountsApprovalRequired"
              label="Accounts Approval Required"
              checked={accountsApprovalRequired}
              onChange={setAccountsApprovalRequired}
            />
            <CheckboxField
              name="hrCanOverrideBalance"
              label="HR Can Override Balance"
              checked={hrCanOverrideBalance}
              onChange={setHrCanOverrideBalance}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          index="6"
          title="Assign Applicable Employees"
          description="Preview and manually assign employees who should receive this policy after activation."
        />
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-medium">
                Showing {filteredEmployees.length} matching employees
              </div>
              <div className="text-muted-foreground">
                {selectedEmployeeIds.length} selected for assignment
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAllVisibleEmployees}>
                Select Visible
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearVisibleEmployees}>
                Clear Visible
              </Button>
            </div>
          </div>
          <div className="grid max-h-72 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-2">
            {filteredEmployees.map((employee) => (
              <label key={employee.id} className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={selectedSet.has(employee.id)}
                  onChange={() => toggleEmployee(employee.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="block font-medium">
                    {employee.code} · {employee.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {employee.branchLabel} · {employee.department || 'No department'} · {employee.employmentType || 'No type'}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {filteredEmployees.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-muted-foreground dark:border-slate-700">
              No employees match the current applicability filters.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {(state?.error || state?.fieldErrors?.rules?.[0] || state?.fieldErrors?.policyName?.[0] || state?.fieldErrors?.employmentType?.[0]) ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state?.error || state?.fieldErrors?.policyName?.[0] || state?.fieldErrors?.employmentType?.[0] || state?.fieldErrors?.rules?.[0]}
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
          {mode === 'edit' ? 'Save & Activate' : 'Save & Activate'}
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
  hideLabel = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="space-y-2">
      {!hideLabel ? (
        <Label htmlFor={name}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      ) : null}
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
  required,
  hideLabel = false,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <div className="space-y-2">
      {!hideLabel ? <Label htmlFor={name}>{label}</Label> : null}
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        value={value}
        required={required}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
      >
        <option value="">{required ? `Select ${label.toLowerCase()}` : `All ${label.toLowerCase()}`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RadioGroup({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="grid gap-3 md:grid-cols-3">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(event) => onChange?.(event.target.value)}
              className="h-4 w-4 border-slate-300"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
