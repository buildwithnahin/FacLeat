'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { createUserAction, updateUserAction, type UserFormState } from '@/server/actions/users';

export interface UserFormProps {
  mode: 'create' | 'edit';
  initial?: {
    id: string;
    employeeId: string | null;
    email: string;
    status: 'ACTIVE' | 'DISABLED' | 'PENDING';
    defaultBranchId: string | null;
    roleId: string | null;
  };
  roles: { id: string; name: string; description: string | null }[];
  branches: { id: string; name: string; code: string }[];
  employees: { id: string; label: string }[];
}

export function UserForm({ mode, initial, roles, branches, employees }: UserFormProps) {
  const action = mode === 'create' ? createUserAction : updateUserAction;
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}

      <Card>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="employeeId">Employee <span className="text-destructive">*</span></Label>
            <select
              id="employeeId"
              name="employeeId"
              required
              defaultValue={initial?.employeeId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.label}</option>
              ))}
            </select>
            {state?.fieldErrors?.employeeId?.length ? (
              <p className="text-xs text-destructive">{state.fieldErrors.employeeId[0]}</p>
            ) : null}
          </div>
          <Field
            label="Username / Email"
            name="email"
            type="email"
            required
            defaultValue={initial?.email}
            errors={state?.fieldErrors?.email}
          />
          <Field
            label={mode === 'create' ? 'Password' : 'New password (leave blank to keep current)'}
            name="password"
            type="password"
            required={mode === 'create'}
            errors={state?.fieldErrors?.password}
          />
          <div className="space-y-2">
            <Label htmlFor="defaultBranchId">Default branch</Label>
            <select
              id="defaultBranchId"
              name="defaultBranchId"
              defaultValue={initial?.defaultBranchId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">— none —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="roleId">Role <span className="text-destructive">*</span></Label>
            <select
              id="roleId"
              name="roleId"
              required
              defaultValue={initial?.roleId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Select ERP role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {state?.fieldErrors?.roleId?.length ? (
              <p className="text-xs text-destructive">{state.fieldErrors.roleId[0]}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={initial?.status ?? 'ACTIVE'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create user' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/users">Cancel</Link>
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
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} />
      {errors?.length && <p className="text-xs text-destructive">{errors[0]}</p>}
    </div>
  );
}
