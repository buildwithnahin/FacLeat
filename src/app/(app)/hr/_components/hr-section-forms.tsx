'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createHrMasterDataAction,
  createHrWorkflowRecordAction,
  updateHrMasterDataAction,
  updateHrWorkflowRecordAction,
  type FormState,
} from '@/server/actions/hr';

export type SelectOption = { id: string; label: string };

const selectClass = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm';

function toDateInput(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : '';
}

export function HrMasterDataForm({
  mode,
  type,
  path,
  branches,
  initial,
}: {
  mode: 'create' | 'edit';
  type: string;
  path: string;
  branches: SelectOption[];
  initial?: {
    id: string;
    branchId: string | null;
    code: string | null;
    name: string;
    description: string | null;
    status: string;
  };
}) {
  const action = mode === 'create' ? createHrMasterDataAction : updateHrMasterDataAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="path" value={path} />
      <Field label="Name" name="name" required errors={state?.fieldErrors?.name} defaultValue={initial?.name ?? ''} />
      <Field label="Code" name="code" errors={state?.fieldErrors?.code} defaultValue={initial?.code ?? ''} />
      <div className="space-y-2">
        <Label htmlFor="branchId">Branch</Label>
        <select id="branchId" name="branchId" defaultValue={initial?.branchId ?? ''} className={selectClass}>
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" defaultValue={initial?.status ?? 'ACTIVE'} className={selectClass}>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="DRAFT">DRAFT</option>
        </select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ''}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <FormFooter
        pending={pending}
        state={state}
        mode={mode}
        path={path}
        createLabel="Save setup record"
        editLabel="Save changes"
      />
    </form>
  );
}

export function HrWorkflowRecordForm({
  mode,
  section,
  path,
  branches,
  employees,
  initial,
}: {
  mode: 'create' | 'edit';
  section: string;
  path: string;
  branches: SelectOption[];
  employees: SelectOption[];
  initial?: {
    id: string;
    branchId: string | null;
    employeeId: string | null;
    title: string;
    subject: string | null;
    status: string;
    priority: string;
    startDate: Date | null;
    endDate: Date | null;
    amount: string;
    owner: string | null;
    notes: string | null;
  };
}) {
  const action = mode === 'create' ? createHrWorkflowRecordAction : updateHrWorkflowRecordAction;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="path" value={path} />
      <Field label="Title" name="title" required errors={state?.fieldErrors?.title} defaultValue={initial?.title ?? ''} />
      <Field label="Subject" name="subject" errors={state?.fieldErrors?.subject} defaultValue={initial?.subject ?? ''} />
      <div className="space-y-2">
        <Label htmlFor="employeeId">Employee</Label>
        <select id="employeeId" name="employeeId" defaultValue={initial?.employeeId ?? ''} className={selectClass}>
          <option value="">Not employee-specific</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="branchId">Branch</Label>
        <select id="branchId" name="branchId" defaultValue={initial?.branchId ?? ''} className={selectClass}>
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" defaultValue={initial?.status ?? 'OPEN'} className={selectClass}>
          <option value="OPEN">OPEN</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <select id="priority" name="priority" defaultValue={initial?.priority ?? 'NORMAL'} className={selectClass}>
          <option value="LOW">LOW</option>
          <option value="NORMAL">NORMAL</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
      </div>
      <Field label="Start date" name="startDate" type="date" errors={state?.fieldErrors?.startDate} defaultValue={toDateInput(initial?.startDate)} />
      <Field label="End date" name="endDate" type="date" errors={state?.fieldErrors?.endDate} defaultValue={toDateInput(initial?.endDate)} />
      <Field label="Amount" name="amount" type="number" errors={state?.fieldErrors?.amount} defaultValue={initial?.amount ?? ''} />
      <Field label="Owner" name="owner" errors={state?.fieldErrors?.owner} defaultValue={initial?.owner ?? ''} />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ''}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <FormFooter
        pending={pending}
        state={state}
        mode={mode}
        path={path}
        createLabel="Save workflow record"
        editLabel="Save changes"
      />
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  errors,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  errors?: string[];
  defaultValue?: string | number;
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

function FormFooter({
  pending,
  state,
  mode,
  path,
  createLabel,
  editLabel,
}: {
  pending: boolean;
  state: FormState;
  mode: 'create' | 'edit';
  path: string;
  createLabel: string;
  editLabel: string;
}) {
  return (
    <div className="md:col-span-2 flex items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving...' : mode === 'create' ? createLabel : editLabel}
      </Button>
      {mode === 'edit' && (
        <Button type="button" variant="outline" asChild>
          <Link href={path}>Cancel</Link>
        </Button>
      )}
      {state?.success && <span className="text-sm text-success">Saved</span>}
      {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
    </div>
  );
}
