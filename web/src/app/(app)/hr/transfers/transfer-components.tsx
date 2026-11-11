'use client';

import { useState, useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  createTransferAction,
  updateTransferAction,
  changeTransferStatusAction,
  type TransferFormState,
} from '@/server/actions/transfers';
import {
  TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  TRANSFER_STATUS_LABELS,
} from '@/server/validators/transfers';

export type SelectOption = { id: string; label: string };

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function toDateInput(value: Date | string | null | undefined) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// ─── Transfer Form ──────────────────────────────────────────────────────

export type EmployeeDetail = {
  branchId: string;
  employeeLabel: string;
  branch: string;
  department: string;
  designation: string;
  shift: string;
};

interface TransferFormProps {
  mode: 'create' | 'edit';
  branches: SelectOption[];
  employees: SelectOption[];
  employeeDetails: Record<string, EmployeeDetail>;
  shifts: SelectOption[];
  departments: string[];
  initial?: {
    id: string;
    branchId: string;
    employeeId: string;
    transferType: string;
    reason: string;
    remarks: string | null;
    newReportingManagerId: string | null;
    newBranchId: string | null;
    newDepartment: string | null;
    newShiftId: string | null;
    tempBranchId: string | null;
    tempDepartment: string | null;
    tempShiftId: string | null;
    startDate: Date | null;
    endDate: Date | null;
    effectiveDate: Date | null;
  };
}

export function TransferForm({
  mode,
  branches,
  employees,
  employeeDetails,
  shifts,
  departments,
  initial,
}: TransferFormProps) {
  const action = mode === 'create' ? createTransferAction : updateTransferAction;
  const [state, formAction, pending] = useActionState<TransferFormState, FormData>(action, undefined);
  const [transferType, setTransferType] = useState(initial?.transferType ?? 'BRANCH');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initial?.employeeId ?? '');
  const currentEmp = selectedEmployeeId ? employeeDetails[selectedEmployeeId] : null;

  const showBranchField = transferType === 'BRANCH';
  const showDepartmentField = transferType === 'DEPARTMENT';
  const showShiftField = transferType === 'SHIFT';
  const showTempFields = transferType === 'TEMPORARY';
  const showPermanentFields = transferType === 'PERMANENT';
  const showEffectiveDate = !showTempFields;
  const currentBranchId = currentEmp?.branchId ?? initial?.branchId ?? '';

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}
      <input type="hidden" name="branchId" value={currentBranchId} />

      {/* Row 1: Employee & Transfer Type */}
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
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className={selectClass}
          >
            <option value="">Select employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          {state?.fieldErrors?.employeeId && (
            <p className="text-xs text-destructive">{state.fieldErrors.employeeId[0]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="transferType">
            Transfer Type <span className="text-destructive">*</span>
          </Label>
          <select
            id="transferType"
            name="transferType"
            required
            value={transferType}
            onChange={(e) => setTransferType(e.target.value)}
            className={selectClass}
          >
            {TRANSFER_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRANSFER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Current Employee Info (read-only context) */}
      {currentEmp && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Employee Information (Read Only)
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2 xl:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Employee:</span>{' '}
              <span className="font-medium">{currentEmp.employeeLabel}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Current Branch:</span>{' '}
              <span className="font-medium">{currentEmp.branch}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Current Department:</span>{' '}
              <span className="font-medium">{currentEmp.department}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Current Shift:</span>{' '}
              <span className="font-medium">{currentEmp.shift}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Current Designation:</span>{' '}
              <span className="font-medium">{currentEmp.designation}</span>
            </div>
          </div>
        </div>
      )}
      {state?.fieldErrors?.branchId && (
        <p className="text-xs text-destructive">{state.fieldErrors.branchId[0]}</p>
      )}

      {/* Effective Date (non-temp types) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {showEffectiveDate && (
          <div className="space-y-2">
            <Label htmlFor="effectiveDate">
              Effective Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="effectiveDate"
              name="effectiveDate"
              type="date"
              defaultValue={toDateInput(initial?.effectiveDate)}
            />
            {state?.fieldErrors?.effectiveDate && (
              <p className="text-xs text-destructive">{state.fieldErrors.effectiveDate[0]}</p>
            )}
          </div>
        )}
      </div>

      {/* Dynamic fields based on transfer type */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Branch Transfer: New Branch */}
        {showBranchField && (
          <div className="space-y-2">
            <Label htmlFor="newBranchId">
              New Branch <span className="text-destructive">*</span>
            </Label>
            <select
              id="newBranchId"
              name="newBranchId"
              className={selectClass}
              defaultValue={initial?.newBranchId ?? ''}
            >
              <option value="">Select new branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            {state?.fieldErrors?.newBranchId && (
              <p className="text-xs text-destructive">{state.fieldErrors.newBranchId[0]}</p>
            )}
          </div>
        )}

        {/* Department Transfer: New Department */}
        {showDepartmentField && (
          <div className="space-y-2">
            <Label htmlFor="newDepartment">
              New Department <span className="text-destructive">*</span>
            </Label>
            <select
              id="newDepartment"
              name="newDepartment"
              className={selectClass}
              defaultValue={initial?.newDepartment ?? ''}
            >
              <option value="">Select new department</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {state?.fieldErrors?.newDepartment && (
              <p className="text-xs text-destructive">{state.fieldErrors.newDepartment[0]}</p>
            )}
          </div>
        )}

        {/* Shift Transfer: New Shift */}
        {showShiftField && (
          <div className="space-y-2">
            <Label htmlFor="newShiftId">
              New Shift <span className="text-destructive">*</span>
            </Label>
            <select
              id="newShiftId"
              name="newShiftId"
              className={selectClass}
              defaultValue={initial?.newShiftId ?? ''}
            >
              <option value="">Select new shift</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {state?.fieldErrors?.newShiftId && (
              <p className="text-xs text-destructive">{state.fieldErrors.newShiftId[0]}</p>
            )}
          </div>
        )}

        {/* Temporary Transfer: Temp Branch, Dept, Shift, Date Range */}
        {showTempFields && (
          <>
            <div className="space-y-2">
              <Label htmlFor="tempBranchId">Temporary Branch</Label>
              <select
                id="tempBranchId"
                name="tempBranchId"
                className={selectClass}
                defaultValue={initial?.tempBranchId ?? ''}
              >
                <option value="">Select branch (optional)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
              {state?.fieldErrors?.tempBranchId && (
                <p className="text-xs text-destructive">{state.fieldErrors.tempBranchId[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempDepartment">Temporary Department</Label>
              <select
                id="tempDepartment"
                name="tempDepartment"
                className={selectClass}
                defaultValue={initial?.tempDepartment ?? ''}
              >
                <option value="">Select department (optional)</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempShiftId">Temporary Shift</Label>
              <select
                id="tempShiftId"
                name="tempShiftId"
                className={selectClass}
                defaultValue={initial?.tempShiftId ?? ''}
              >
                <option value="">Select shift (optional)</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={toDateInput(initial?.startDate)}
              />
              {state?.fieldErrors?.startDate && (
                <p className="text-xs text-destructive">{state.fieldErrors.startDate[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={toDateInput(initial?.endDate)}
              />
              {state?.fieldErrors?.endDate && (
                <p className="text-xs text-destructive">{state.fieldErrors.endDate[0]}</p>
              )}
            </div>
          </>
        )}

        {/* Permanent Transfer: New Branch, Dept, Shift */}
        {showPermanentFields && (
          <>
            <div className="space-y-2">
              <Label htmlFor="newBranchId">New Branch</Label>
              <select
                id="newBranchId"
                name="newBranchId"
                className={selectClass}
                defaultValue={initial?.newBranchId ?? ''}
              >
                <option value="">Select branch (optional)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDepartment">New Department</Label>
              <select
                id="newDepartment"
                name="newDepartment"
                className={selectClass}
                defaultValue={initial?.newDepartment ?? ''}
              >
                <option value="">Select department (optional)</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newShiftId">New Shift</Label>
              <select
                id="newShiftId"
                name="newShiftId"
                className={selectClass}
                defaultValue={initial?.newShiftId ?? ''}
              >
                <option value="">Select shift (optional)</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">
          Reason <span className="text-destructive">*</span>
        </Label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          required
          defaultValue={initial?.reason ?? ''}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Explain the reason for this transfer..."
        />
        {state?.fieldErrors?.reason && (
          <p className="text-xs text-destructive">{state.fieldErrors.reason[0]}</p>
        )}
      </div>

      {/* Remarks */}
      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks</Label>
        <textarea
          id="remarks"
          name="remarks"
          rows={2}
          defaultValue={initial?.remarks ?? ''}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Optional notes..."
        />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : mode === 'create' ? 'Create Transfer' : 'Save Changes'}
        </Button>
        {mode === 'edit' && (
          <Button type="button" variant="outline" asChild>
            <Link href="/hr/transfers">Cancel</Link>
          </Button>
        )}
        {state?.success && <span className="text-sm text-emerald-600">Transfer saved ✓</span>}
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}

// ─── Status Action Buttons ─────────────────────────────────────────────

interface TransferStatusActionsProps {
  transfer: {
    id: string;
    status: string;
  };
}

export function TransferStatusActions({ transfer }: TransferStatusActionsProps) {
  const actions: { action: string; label: string; variant: 'default' | 'destructive' | 'outline' }[] = [];

  switch (transfer.status) {
    case 'DRAFT':
      actions.push({ action: 'submit', label: 'Submit for Approval', variant: 'default' });
      actions.push({ action: 'cancel', label: 'Cancel', variant: 'destructive' });
      break;
    case 'SUBMITTED':
      actions.push({ action: 'approve', label: 'Approve', variant: 'default' });
      actions.push({ action: 'reject', label: 'Reject', variant: 'destructive' });
      actions.push({ action: 'cancel', label: 'Cancel', variant: 'outline' });
      break;
    case 'PENDING_APPROVAL':
      actions.push({ action: 'cancel', label: 'Cancel', variant: 'outline' });
      break;
    case 'APPROVED':
      actions.push({ action: 'complete', label: 'Complete Transfer', variant: 'default' });
      break;
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex gap-2">
      {actions.map((a) => (
        <form key={a.action} action={changeTransferStatusAction}>
          <input type="hidden" name="id" value={transfer.id} />
          <input type="hidden" name="action" value={a.action} />
          <Button type="submit" variant={a.variant} size="sm">
            {a.label}
          </Button>
        </form>
      ))}
    </div>
  );
}

// ─── Transfer Table ────────────────────────────────────────────────────

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'APPROVED':
      return 'success' as const;
    case 'REJECTED':
    case 'CANCELLED':
      return 'destructive' as const;
    case 'SUBMITTED':
    case 'PENDING_APPROVAL':
      return 'warning' as const;
    default:
      return 'outline' as const;
  }
}

interface TransferTableProps {
  transfers: Array<{
    id: string;
    transferNumber: string;
    transferType: string;
    status: string;
    reason: string;
    effectiveDate: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    createdAt: Date;
    employee: { code: string; firstName: string; lastName: string } | null;
    branch: { code: string; name: string } | null;
    newBranch: { code: string; name: string } | null;
    tempBranch: { code: string; name: string } | null;
    newShift: { name: string } | null;
    tempShift: { name: string } | null;
    newDepartment: string | null;
    tempDepartment: string | null;
  }>;
  canWrite: boolean;
}

export function TransferTable({ transfers, canWrite }: TransferTableProps) {
  if (transfers.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        No transfer records found. Create a new transfer to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Transfer #</th>
            <th className="px-4 py-3 text-left">Employee</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Destination</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Status</th>
            {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {transfers.map((t) => {
            const destination = getDestinationText(t);
            const dateText = getDateText(t);

            return (
              <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                  {t.transferNumber}
                </td>
                <td className="px-4 py-3">
                  {t.employee ? (
                    <div>
                      <div className="font-medium">
                        {t.employee.firstName} {t.employee.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">{t.employee.code}</div>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{TRANSFER_TYPE_LABELS[t.transferType] ?? t.transferType}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{destination}</td>
                <td className="px-4 py-3 text-muted-foreground">{dateText}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusBadgeVariant(t.status)}>
                    {TRANSFER_STATUS_LABELS[t.status] ?? t.status}
                  </Badge>
                </td>
                {canWrite && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {t.status === 'DRAFT' && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/hr/transfers?edit=${t.id}`}>Edit</Link>
                        </Button>
                      )}
                      <TransferStatusActions transfer={t} />
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getDestinationText(t: {
  transferType: string;
  newBranch: { name: string } | null;
  newDepartment: string | null;
  newShift: { name: string } | null;
  tempBranch: { name: string } | null;
  tempDepartment: string | null;
  tempShift: { name: string } | null;
}): string {
  switch (t.transferType) {
    case 'BRANCH':
      return t.newBranch?.name ?? '-';
    case 'DEPARTMENT':
      return t.newDepartment ?? '-';
    case 'SHIFT':
      return t.newShift?.name ?? '-';
    case 'TEMPORARY': {
      const parts = [t.tempBranch?.name, t.tempDepartment, t.tempShift?.name].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : '-';
    }
    case 'PERMANENT': {
      const parts = [t.newBranch?.name, t.newDepartment, t.newShift?.name].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : '-';
    }
    default:
      return '-';
  }
}

function getDateText(t: {
  transferType: string;
  effectiveDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
}): string {
  if (t.transferType === 'TEMPORARY') {
    const s = t.startDate ? t.startDate.toISOString().slice(0, 10) : '?';
    const e = t.endDate ? t.endDate.toISOString().slice(0, 10) : '?';
    return `${s} → ${e}`;
  }
  return t.effectiveDate ? t.effectiveDate.toISOString().slice(0, 10) : '-';
}

// ─── KPI Cards ─────────────────────────────────────────────────────────

interface TransferKpiCardsProps {
  counts: Record<string, number>;
}

export function TransferKpiCards({ counts }: TransferKpiCardsProps) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const cards = [
    { label: 'Total', value: total, color: 'text-primary' },
    { label: 'Draft', value: counts['DRAFT'] ?? 0, color: 'text-muted-foreground' },
    { label: 'Pending', value: (counts['SUBMITTED'] ?? 0) + (counts['PENDING_APPROVAL'] ?? 0), color: 'text-amber-600' },
    { label: 'Approved', value: counts['APPROVED'] ?? 0, color: 'text-blue-600' },
    { label: 'Completed', value: counts['COMPLETED'] ?? 0, color: 'text-emerald-600' },
    { label: 'Rejected', value: counts['REJECTED'] ?? 0, color: 'text-red-600' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground">{c.label}</div>
            <div className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
