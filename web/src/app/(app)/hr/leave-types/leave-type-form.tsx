'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createLeaveTypeAction,
  updateLeaveTypeAction,
  type LeaveTypeFormState,
} from '@/server/actions/leave-types';
import {
  LEAVE_ATTACHMENT_TYPES,
  LEAVE_TYPE_GENDERS,
  LEAVE_TYPE_STATUSES,
  LEAVE_TYPE_UNITS,
} from '@/server/validators/leave-types';

type LeaveTypeValue = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  paidLeave: boolean;
  annualEntitlement: number | null;
  maxConsecutiveDays: number | null;
  minimumLeaveDays: number | null;
  applyBeforeDays: number | null;
  unit: string;
  applicableEmploymentTypes: string[];
  genderApplicability: string;
  applicableDepartment: string | null;
  applicableDesignation: string | null;
  applicableBranchId: string | null;
  attachmentRequired: boolean;
  medicalCertificateRequired: boolean;
  allowHalfDay: boolean;
  allowBackdatedApplication: boolean;
  allowFutureApplication: boolean;
  approvalRequired: boolean;
  autoApprove: boolean;
  holidayIncluded: boolean;
  weekendIncluded: boolean;
  carryForwardAllowed: boolean;
  maximumCarryForwardDays: number | null;
  carryForwardExpiryMonths: number | null;
  requiredAttachmentTypes: string[];
  allowNegativeBalance: boolean;
  displayOrder: number;
};

function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="h-4 w-4 rounded border-slate-300" />
      <span>{label}</span>
    </label>
  );
}

function MultiCheckboxGroup({
  title,
  options,
  selected,
  setSelected,
}: {
  title: string;
  options: string[];
  selected: string[];
  setSelected: (next: string[]) => void;
}) {
  const toggle = (value: string) => {
    setSelected(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  };

  return (
    <div className="space-y-2">
      <Label>{title}</Label>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => toggle(option)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>{option.replaceAll('_', ' ')}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function LeaveTypeForm({
  mode,
  initial,
  branches,
  departments,
  designations,
  employmentTypes,
  path,
}: {
  mode: 'create' | 'edit';
  initial?: LeaveTypeValue | null;
  branches: Array<{ value: string; label: string }>;
  departments: string[];
  designations: string[];
  employmentTypes: string[];
  path: string;
}) {
  const action = mode === 'create' ? createLeaveTypeAction : updateLeaveTypeAction;
  const [state, formAction, pending] = useActionState<LeaveTypeFormState, FormData>(action, undefined);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>(initial?.applicableEmploymentTypes ?? []);
  const [selectedAttachmentTypes, setSelectedAttachmentTypes] = useState<string[]>(initial?.requiredAttachmentTypes ?? []);

  return (
    <form action={formAction} className="space-y-6">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="applicableEmploymentTypes" value={JSON.stringify(selectedEmploymentTypes)} />
      <input type="hidden" name="requiredAttachmentTypes" value={JSON.stringify(selectedAttachmentTypes)} />

      <Card>
        <CardHeader>
          <CardTitle>{mode === 'create' ? 'Create Leave Type' : 'Edit Leave Type'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Leave Type Name" name="name" required defaultValue={initial?.name ?? ''} />
          <Field label="Leave Code" name="code" required defaultValue={initial?.code ?? ''} />
          <SelectField label="Status" name="status" defaultValue={initial?.status ?? 'ACTIVE'} options={LEAVE_TYPE_STATUSES.map((value) => ({ value, label: value }))} />
          <Field label="Display Order" name="displayOrder" type="number" defaultValue={String(initial?.displayOrder ?? 0)} />
          <div className="md:col-span-2 xl:col-span-4">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={initial?.description ?? ''} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectField label="Unit" name="unit" defaultValue={initial?.unit ?? 'FULL_DAY'} options={LEAVE_TYPE_UNITS.map((value) => ({ value, label: value.replaceAll('_', ' ') }))} />
            <Field label="Annual Entitlement" name="annualEntitlement" type="number" step="0.5" defaultValue={initial?.annualEntitlement == null ? '' : String(initial.annualEntitlement)} />
            <Field label="Maximum Consecutive Days" name="maxConsecutiveDays" type="number" step="0.5" defaultValue={initial?.maxConsecutiveDays == null ? '' : String(initial.maxConsecutiveDays)} />
            <Field label="Minimum Leave Days" name="minimumLeaveDays" type="number" step="0.5" defaultValue={initial?.minimumLeaveDays == null ? '' : String(initial.minimumLeaveDays)} />
            <Field label="Apply Before Days" name="applyBeforeDays" type="number" defaultValue={initial?.applyBeforeDays == null ? '' : String(initial.applyBeforeDays)} />
            <Field label="Max Carry Forward Days" name="maximumCarryForwardDays" type="number" step="0.5" defaultValue={initial?.maximumCarryForwardDays == null ? '' : String(initial.maximumCarryForwardDays)} />
            <Field label="Carry Forward Expiry Months" name="carryForwardExpiryMonths" type="number" defaultValue={initial?.carryForwardExpiryMonths == null ? '' : String(initial.carryForwardExpiryMonths)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <CheckboxField name="paidLeave" label="Paid Leave" defaultChecked={initial?.paidLeave ?? true} />
            <CheckboxField name="attachmentRequired" label="Attachment Required" defaultChecked={initial?.attachmentRequired ?? false} />
            <CheckboxField name="medicalCertificateRequired" label="Medical Certificate Required" defaultChecked={initial?.medicalCertificateRequired ?? false} />
            <CheckboxField name="allowHalfDay" label="Allow Half Day" defaultChecked={initial?.allowHalfDay ?? false} />
            <CheckboxField name="allowBackdatedApplication" label="Allow Backdated Application" defaultChecked={initial?.allowBackdatedApplication ?? false} />
            <CheckboxField name="allowFutureApplication" label="Allow Future Application" defaultChecked={initial?.allowFutureApplication ?? true} />
            <CheckboxField name="approvalRequired" label="Approval Required" defaultChecked={initial?.approvalRequired ?? true} />
            <CheckboxField name="autoApprove" label="Auto Approve" defaultChecked={initial?.autoApprove ?? false} />
            <CheckboxField name="holidayIncluded" label="Holiday Included" defaultChecked={initial?.holidayIncluded ?? false} />
            <CheckboxField name="weekendIncluded" label="Weekend Included" defaultChecked={initial?.weekendIncluded ?? false} />
            <CheckboxField name="carryForwardAllowed" label="Carry Forward Allowed" defaultChecked={initial?.carryForwardAllowed ?? false} />
            <CheckboxField name="allowNegativeBalance" label="Allow Negative Balance" defaultChecked={initial?.allowNegativeBalance ?? false} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eligibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectField label="Gender" name="genderApplicability" defaultValue={initial?.genderApplicability ?? 'ALL'} options={LEAVE_TYPE_GENDERS.map((value) => ({ value, label: value.replaceAll('_', ' ') }))} />
            <SelectField label="Department" name="applicableDepartment" defaultValue={initial?.applicableDepartment ?? ''} options={departments.map((value) => ({ value, label: value }))} />
            <SelectField label="Designation" name="applicableDesignation" defaultValue={initial?.applicableDesignation ?? ''} options={designations.map((value) => ({ value, label: value }))} />
            <SelectField label="Branch" name="applicableBranchId" defaultValue={initial?.applicableBranchId ?? ''} options={branches} />
          </div>
          <MultiCheckboxGroup
            title="Applicable Employment Types"
            options={employmentTypes}
            selected={selectedEmploymentTypes}
            setSelected={setSelectedEmploymentTypes}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <MultiCheckboxGroup
            title="Required Attachment Types"
            options={[...LEAVE_ATTACHMENT_TYPES]}
            selected={selectedAttachmentTypes}
            setSelected={setSelectedAttachmentTypes}
          />
        </CardContent>
      </Card>

      {state?.error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{state.error}</p> : null}
      {state?.success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Leave type saved successfully.</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? 'Saving...' : mode === 'create' ? 'Save Leave Type' : 'Update Leave Type'}</Button>
        <Button type="button" variant="outline" asChild>
          <Link href={path}>Cancel</Link>
        </Button>
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
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} step={step} />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
