'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { createEmployeeAction, updateEmployeeAction, type FormState } from '@/server/actions/hr';
import type { DesignationOption } from '@/lib/hr-master-data';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  DEFAULT_EMPLOYMENT_TYPES,
  EMPLOYMENT_STATUSES,
} from '@/server/validators/hr';

export interface EmployeeFormProps {
  mode: 'create' | 'edit';
  branches: { id: string; code: string; name: string }[];
  initial?: {
    id: string;
    branchId: string;
    code: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    designation: string | null;
    department: string | null;
    employmentType: string | null;
    shiftId: string | null;
    reportingManagerId: string | null;
    systemRoleId: string | null;
    joinedAt: string;
    status: (typeof EMPLOYMENT_STATUSES)[number];
    basicSalary: string;
    houseAllowance: string;
    transportAllowance: string;
    medicalAllowance: string;
    otherAllowance: string;
    providentFund: string;
    taxDeduction: string;
    bankName: string | null;
    bankAccount: string | null;
  };
  departments?: string[];
  designationOptions?: DesignationOption[];
  employmentTypes?: string[];
  shifts?: { id: string; label: string }[];
  managers?: { id: string; label: string }[];
  roles?: { id: string; name: string }[];
}

export function EmployeeForm({
  mode,
  branches,
  initial,
  departments = [...DEFAULT_DEPARTMENTS],
  designationOptions = DEFAULT_DESIGNATIONS.map((name) => ({ name, department: null })),
  employmentTypes = [...DEFAULT_EMPLOYMENT_TYPES],
  shifts = [],
  managers = [],
  roles = [],
}: EmployeeFormProps) {
  const action = mode === 'create' ? createEmployeeAction : updateEmployeeAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [selectedDepartment, setSelectedDepartment] = useState(initial?.department ?? '');
  const [selectedDesignation, setSelectedDesignation] = useState(initial?.designation ?? '');

  const filteredDesignationOptions = useMemo(() => {
    const matches = designationOptions.filter(
      (option) => !option.department || !selectedDepartment || option.department === selectedDepartment,
    );
    const values = matches.length ? matches : designationOptions;
    const names = new Set<string>();
    return values.filter((option) => {
      if (names.has(option.name)) return false;
      names.add(option.name);
      return true;
    });
  }, [designationOptions, selectedDepartment]);

  useEffect(() => {
    if (!selectedDesignation) return;
    if (!filteredDesignationOptions.some((option) => option.name === selectedDesignation)) {
      setSelectedDesignation('');
    }
  }, [filteredDesignationOptions, selectedDesignation]);

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}
      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Code" name="code" required defaultValue={initial?.code} errors={state?.fieldErrors?.code} />
          <div className="space-y-2">
            <Label htmlFor="branchId">Branch</Label>
            <select
              id="branchId"
              name="branchId"
              defaultValue={initial?.branchId ?? branches[0]?.id}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.code} · {b.name}</option>
              ))}
            </select>
          </div>
          <Field label="First name" name="firstName" required defaultValue={initial?.firstName} />
          <Field label="Last name" name="lastName" required defaultValue={initial?.lastName} />
          <Field label="Email" name="email" type="email" defaultValue={initial?.email ?? ''} />
          <Field label="Phone" name="phone" defaultValue={initial?.phone ?? ''} />
          <SelectField
            label="Department"
            name="department"
            required
            value={selectedDepartment}
            onChange={setSelectedDepartment}
            options={departments}
          />
          <SelectField
            label="Designation"
            name="designation"
            required
            value={selectedDesignation}
            onChange={setSelectedDesignation}
            options={filteredDesignationOptions.map((option) => option.name)}
          />
          <SelectField label="Employment Type" name="employmentType" required defaultValue={initial?.employmentType ?? 'PERMANENT'} options={employmentTypes} />
          <div className="space-y-2">
            <Label htmlFor="shiftId">Shift</Label>
            <select
              id="shiftId"
              name="shiftId"
              defaultValue={initial?.shiftId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">No shift assigned</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>{shift.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reportingManagerId">Reporting Manager</Label>
            <select
              id="reportingManagerId"
              name="reportingManagerId"
              defaultValue={initial?.reportingManagerId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">No manager</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>{manager.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemRoleId">Role</Label>
            <select
              id="systemRoleId"
              name="systemRoleId"
              defaultValue={initial?.systemRoleId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">No system access role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
          <Field label="Joined at" name="joinedAt" type="date" required defaultValue={initial?.joinedAt} />
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={initial?.status ?? 'ACTIVE'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 text-sm font-semibold">Salary structure (monthly)</div>
          <Field label="Basic" name="basicSalary" type="number" defaultValue={initial?.basicSalary ?? '0'} />
          <Field label="House allowance" name="houseAllowance" type="number" defaultValue={initial?.houseAllowance ?? '0'} />
          <Field label="Transport allowance" name="transportAllowance" type="number" defaultValue={initial?.transportAllowance ?? '0'} />
          <Field label="Medical allowance" name="medicalAllowance" type="number" defaultValue={initial?.medicalAllowance ?? '0'} />
          <Field label="Other allowance" name="otherAllowance" type="number" defaultValue={initial?.otherAllowance ?? '0'} />
          <div />
          <Field label="Provident fund (deduction)" name="providentFund" type="number" defaultValue={initial?.providentFund ?? '0'} />
          <Field label="Tax (deduction)" name="taxDeduction" type="number" defaultValue={initial?.taxDeduction ?? '0'} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Bank name" name="bankName" defaultValue={initial?.bankName ?? ''} />
          <Field label="Bank account" name="bankAccount" defaultValue={initial?.bankAccount ?? ''} />
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create employee' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/hr/employees">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

function SelectField({
  label,
  name,
  required,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  options: string[];
}) {
  const values = Array.from(new Set([value, ...options].filter(Boolean)));
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <select
        id={name}
        name={name}
        required={required}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {values.map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  errors?: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} />
      {errors?.length ? <p className="text-xs text-destructive">{errors[0]}</p> : null}
    </div>
  );
}
