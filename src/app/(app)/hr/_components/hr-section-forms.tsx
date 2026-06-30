'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createHrMasterDataAction, createHrWorkflowRecordAction, type FormState } from '@/server/actions/hr';

export type SelectOption = { id: string; label: string };

export function HrMasterDataForm({
  type,
  path,
  branches,
}: {
  type: string;
  path: string;
  branches: SelectOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createHrMasterDataAction, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="path" value={path} />
      <Field label="Name" name="name" required errors={state?.fieldErrors?.name} />
      <Field label="Code" name="code" errors={state?.fieldErrors?.code} />
      <div className="space-y-2">
        <Label htmlFor="branchId">Branch</Label>
        <select id="branchId" name="branchId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" defaultValue="ACTIVE" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="DRAFT">DRAFT</option>
        </select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
      </div>
      <FormFooter pending={pending} state={state} label="Save setup record" />
    </form>
  );
}

export function HrWorkflowRecordForm({
  section,
  path,
  branches,
  employees,
}: {
  section: string;
  path: string;
  branches: SelectOption[];
  employees: SelectOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createHrWorkflowRecordAction, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="path" value={path} />
      <Field label="Title" name="title" required errors={state?.fieldErrors?.title} />
      <Field label="Subject" name="subject" errors={state?.fieldErrors?.subject} />
      <div className="space-y-2">
        <Label htmlFor="employeeId">Employee</Label>
        <select id="employeeId" name="employeeId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">Not employee-specific</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="branchId">Branch</Label>
        <select id="branchId" name="branchId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" defaultValue="OPEN" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
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
        <select id="priority" name="priority" defaultValue="NORMAL" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="LOW">LOW</option>
          <option value="NORMAL">NORMAL</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
      </div>
      <Field label="Start date" name="startDate" type="date" errors={state?.fieldErrors?.startDate} />
      <Field label="End date" name="endDate" type="date" errors={state?.fieldErrors?.endDate} />
      <Field label="Amount" name="amount" type="number" errors={state?.fieldErrors?.amount} />
      <Field label="Owner" name="owner" errors={state?.fieldErrors?.owner} />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea id="notes" name="notes" rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
      </div>
      <FormFooter pending={pending} state={state} label="Save workflow record" />
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  errors?: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input id={name} name={name} type={type} required={required} />
      {errors?.length ? <p className="text-xs text-destructive">{errors[0]}</p> : null}
    </div>
  );
}

function FormFooter({ pending, state, label }: { pending: boolean; state: FormState; label: string }) {
  return (
    <div className="md:col-span-2 flex items-center gap-3">
      <Button type="submit" disabled={pending}>{pending ? 'Saving...' : label}</Button>
      {state?.success && <span className="text-sm text-success">Saved</span>}
      {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
    </div>
  );
}
