'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { createContractAction, updateContractAction, type ContractFormState } from '@/server/actions/contracts';
import { CONTRACT_STATUSES, CONTRACT_TYPES } from '@/server/validators/contracts';

export interface FormEmployee {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  branchId: string;
  branchName: string;
  department: string | null;
  designation: string | null;
  shiftId: string | null;
  shiftName: string | null;
  basicSalary: number;
  allowances: number;
}

export interface ContractFormProps {
  mode: 'create' | 'edit';
  branches: { id: string; name: string; code: string }[];
  shifts: { id: string; name: string; code: string }[];
  employees: FormEmployee[];
  initial?: {
    id: string;
    contractNo: string;
    employeeId: string;
    branchId: string | null;
    department: string | null;
    designation: string | null;
    contractType: string;
    startDate: string;
    endDate: string | null;
    basicSalary: string;
    allowances: string;
    shiftId: string | null;
    weeklyOff: string;
    status: string;
    attachmentUrl: string | null;
    notes: string | null;
  };
}

export function ContractForm({ mode, branches, shifts, employees, initial }: ContractFormProps) {
  const action = mode === 'create' ? createContractAction : updateContractAction;
  const [state, formAction, pending] = useActionState<ContractFormState, FormData>(action, undefined);
  const E = (field: string) => state?.fieldErrors?.[field]?.[0];

  const [selectedEmpId, setSelectedEmpId] = useState(initial?.employeeId || '');
  const [department, setDepartment] = useState(initial?.department || '');
  const [designation, setDesignation] = useState(initial?.designation || '');
  const [branchId, setBranchId] = useState(initial?.branchId || '');
  const [shiftId, setShiftId] = useState(initial?.shiftId || '');
  const [basicSalary, setBasicSalary] = useState(initial?.basicSalary || '0');
  const [allowances, setAllowances] = useState(initial?.allowances || '0');
  const [contractType, setContractType] = useState(initial?.contractType || 'CONTRACT');

  const handleEmployeeChange = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setDepartment(emp.department || '');
      setDesignation(emp.designation || '');
      setBranchId(emp.branchId || '');
      setShiftId(emp.shiftId || '');
      setBasicSalary(emp.basicSalary.toString());
      setAllowances(emp.allowances.toString());
    }
  };

  return (
    <form action={formAction} className="space-y-6" encType="multipart/form-data">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}

      <Card>
        <CardContent className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Contract No */}
          <div className="space-y-2">
            <Label htmlFor="contractNo">
              Contract No <span className="text-destructive">*</span>
            </Label>
            <Input id="contractNo" name="contractNo" required defaultValue={initial?.contractNo} placeholder="e.g. CNT-2026-0001" />
            {E('contractNo') && <p className="text-xs text-destructive">{E('contractNo')}</p>}
          </div>

          {/* Employee */}
          <div className="space-y-2">
            <Label htmlFor="employeeId">
              Employee <span className="text-destructive">*</span>
            </Label>
            <select
              id="employeeId"
              name="employeeId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              required
              value={selectedEmpId}
              onChange={(e) => handleEmployeeChange(e.target.value)}
              disabled={mode === 'edit'}
            >
              <option value="">Select Employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.code} · {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
            {mode === 'edit' && <input type="hidden" name="employeeId" value={selectedEmpId} />}
            {E('employeeId') && <p className="text-xs text-destructive">{E('employeeId')}</p>}
          </div>

          {/* Branch */}
          <div className="space-y-2">
            <Label htmlFor="branchId">Branch</Label>
            <select
              id="branchId"
              name="branchId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
            {E('branchId') && <p className="text-xs text-destructive">{E('branchId')}</p>}
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Production, HR, etc." />
            {E('department') && <p className="text-xs text-destructive">{E('department')}</p>}
          </div>

          {/* Designation */}
          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input id="designation" name="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Production Supervisor, Engineer, etc." />
            {E('designation') && <p className="text-xs text-destructive">{E('designation')}</p>}
          </div>

          {/* Contract Type */}
          <div className="space-y-2">
            <Label htmlFor="contractType">
              Contract Type <span className="text-destructive">*</span>
            </Label>
            <select
              id="contractType"
              name="contractType"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              required
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
            >
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {E('contractType') && <p className="text-xs text-destructive">{E('contractType')}</p>}
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate">
              Start Date <span className="text-destructive">*</span>
            </Label>
            <Input id="startDate" name="startDate" type="date" required defaultValue={initial?.startDate} />
            {E('startDate') && <p className="text-xs text-destructive">{E('startDate')}</p>}
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="endDate">
              End Date {contractType !== 'PERMANENT' && <span className="text-destructive">*</span>}
            </Label>
            <Input id="endDate" name="endDate" type="date" required={contractType !== 'PERMANENT'} defaultValue={initial?.endDate || ''} />
            {E('endDate') && <p className="text-xs text-destructive">{E('endDate')}</p>}
          </div>

          {/* Basic Salary */}
          <div className="space-y-2">
            <Label htmlFor="basicSalary">
              Basic Salary <span className="text-destructive">*</span>
            </Label>
            <Input id="basicSalary" name="basicSalary" type="number" step="0.01" required value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} />
            {E('basicSalary') && <p className="text-xs text-destructive">{E('basicSalary')}</p>}
          </div>

          {/* Allowances */}
          <div className="space-y-2">
            <Label htmlFor="allowances">Allowances</Label>
            <Input id="allowances" name="allowances" type="number" step="0.01" value={allowances} onChange={(e) => setAllowances(e.target.value)} />
            {E('allowances') && <p className="text-xs text-destructive">{E('allowances')}</p>}
          </div>

          {/* Shift */}
          <div className="space-y-2">
            <Label htmlFor="shiftId">Working Shift</Label>
            <select
              id="shiftId"
              name="shiftId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
            >
              <option value="">Select Shift...</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
            {E('shiftId') && <p className="text-xs text-destructive">{E('shiftId')}</p>}
          </div>

          {/* Weekly Off */}
          <div className="space-y-2">
            <Label htmlFor="weeklyOff">Weekly Off</Label>
            <Input id="weeklyOff" name="weeklyOff" defaultValue={initial?.weeklyOff || 'Friday'} placeholder="Friday, Sunday, etc." />
            {E('weeklyOff') && <p className="text-xs text-destructive">{E('weeklyOff')}</p>}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              defaultValue={initial?.status || 'DRAFT'}
            >
              {CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {E('status') && <p className="text-xs text-destructive">{E('status')}</p>}
          </div>

          {/* Attachment */}
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="attachmentFile">Signed Contract Attachment (Image or File)</Label>
            <Input
              id="attachmentFile"
              name="attachmentFile"
              type="file"
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
            />
            {initial?.attachmentUrl && (
              <div className="flex items-center gap-2 mt-1">
                <input type="hidden" name="existingAttachmentUrl" value={initial.attachmentUrl} />
                <span className="text-xs text-muted-foreground">Current attachment:</span>
                <a
                  href={`/api/hr/contracts/${initial.id}/attachment`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View current file
                </a>
              </div>
            )}
            {E('attachmentUrl') && <p className="text-xs text-destructive">{E('attachmentUrl')}</p>}
          </div>

          {/* Notes */}
          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={initial?.notes || ''} placeholder="Add any special clauses, terms, or notes about renewals." />
            {E('notes') && <p className="text-xs text-destructive">{E('notes')}</p>}
          </div>
        </CardContent>
      </Card>

      {state?.error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</div>}

      <div className="flex gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create Contract' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/hr/contracts">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
