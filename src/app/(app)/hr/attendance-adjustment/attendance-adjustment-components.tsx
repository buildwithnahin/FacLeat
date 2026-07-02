'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AttendanceAdjustmentFormState,
  cancelAttendanceAdjustmentAction,
  saveAttendanceAdjustmentAction,
} from '@/server/actions/attendance-adjustments';
import {
  ADJUSTMENT_STATUS_LABELS,
  ATTENDANCE_ADJUSTMENT_STATUS_LABELS,
  ATTENDANCE_ADJUSTMENT_TYPE_LABELS,
  ATTENDANCE_ADJUSTMENT_TYPES,
} from '@/server/validators/attendance-adjustments';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

type EmployeeOption = {
  id: string;
  label: string;
  employeeCode: string;
  branch: string;
  department: string;
  designation: string;
  shiftId: string;
  shiftName: string;
};

type ShiftOption = {
  id: string;
  label: string;
};

type Snapshot = {
  checkIn: string;
  checkOut: string;
  status: string;
  workedHours: string;
  otHours: string;
};

type AdjustmentRecord = {
  id: string;
  adjustmentNumber: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  attendanceDate: string;
  adjustmentType: string;
  oldStatus: string;
  newStatus: string;
  adjustedBy: string;
  status: string;
  reason: string;
  remarks: string;
  attachmentUrl: string;
  oldCheckIn: string;
  oldCheckOut: string;
  oldWorkingHours: string;
  oldOtHours: string;
  newCheckIn: string;
  newCheckOut: string;
  newShiftId: string;
};

function statusVariant(status: string) {
  if (['UPDATED'].includes(status)) return 'success' as const;
  if (['CANCELLED', 'ABSENT'].includes(status)) return 'destructive' as const;
  if (['DRAFT', 'LATE', 'HALF_DAY'].includes(status)) return 'warning' as const;
  return 'outline' as const;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm">{value || '-'}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <div className="mb-4 text-sm font-semibold">{title}</div>
      {children}
    </section>
  );
}

export function AttendanceAdjustmentForm({
  employees,
  shifts,
  snapshots,
  date,
  initial,
}: {
  employees: EmployeeOption[];
  shifts: ShiftOption[];
  snapshots: Record<string, Snapshot>;
  date: string;
  initial?: AdjustmentRecord | null;
}) {
  const [state, formAction, pending] = useActionState<AttendanceAdjustmentFormState, FormData>(
    saveAttendanceAdjustmentAction,
    undefined,
  );
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initial?.employeeId ?? employees[0]?.id ?? '');
  const employee = employees.find((item) => item.id === selectedEmployeeId) ?? null;
  const snapshot = useMemo(() => {
    if (initial) {
      return {
        checkIn: initial.oldCheckIn,
        checkOut: initial.oldCheckOut,
        status: initial.oldStatus,
        workedHours: initial.oldWorkingHours,
        otHours: initial.oldOtHours,
      };
    }
    return snapshots[selectedEmployeeId] ?? {
      checkIn: '-',
      checkOut: '-',
      status: 'ABSENT',
      workedHours: '0.0 hrs',
      otHours: '0.0 hrs',
    };
  }, [initial, selectedEmployeeId, snapshots]);

  return (
    <form action={formAction} className="space-y-6">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Section title="Employee Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyField label="Adjustment No" value={initial?.adjustmentNumber ?? 'Auto after save'} />
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="employeeId">Employee</Label>
            <select
              id="employeeId"
              name="employeeId"
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
              className={selectClass}
              required
            >
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <ReadOnlyField label="Employee ID" value={employee?.employeeCode ?? '-'} />
          <ReadOnlyField label="Branch" value={employee?.branch ?? '-'} />
          <ReadOnlyField label="Department" value={employee?.department ?? '-'} />
          <ReadOnlyField label="Designation" value={employee?.designation ?? '-'} />
          <ReadOnlyField label="Shift" value={employee?.shiftName ?? '-'} />
          <div className="space-y-2">
            <Label htmlFor="attendanceDate">Attendance Date</Label>
            <Input id="attendanceDate" name="attendanceDate" type="date" defaultValue={initial?.attendanceDate ?? date} required />
          </div>
        </div>
      </Section>

      <Section title="Attendance Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ReadOnlyField label="Original Check-In" value={snapshot.checkIn} />
          <ReadOnlyField label="Original Check-Out" value={snapshot.checkOut} />
          <ReadOnlyField label="Original Working Hours" value={snapshot.workedHours} />
          <ReadOnlyField label="Original OT" value={snapshot.otHours} />
          <ReadOnlyField label="Original Status" value={ADJUSTMENT_STATUS_LABELS[snapshot.status] ?? snapshot.status} />
        </div>
      </Section>

      <Section title="Adjustment Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="adjustmentType">Adjustment Type</Label>
            <select id="adjustmentType" name="adjustmentType" defaultValue={initial?.adjustmentType ?? 'MISSING_CHECK_OUT'} className={selectClass}>
              {ATTENDANCE_ADJUSTMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ATTENDANCE_ADJUSTMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="newCheckIn">New Check-In</Label>
            <Input id="newCheckIn" name="newCheckIn" type="time" defaultValue={initial?.newCheckIn ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newCheckOut">New Check-Out</Label>
            <Input id="newCheckOut" name="newCheckOut" type="time" defaultValue={initial?.newCheckOut ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newStatus">New Status</Label>
            <select id="newStatus" name="newStatus" defaultValue={initial?.newStatus ?? 'PRESENT'} className={selectClass}>
              {Object.entries(ADJUSTMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="newShiftId">New Shift</Label>
            <select id="newShiftId" name="newShiftId" defaultValue={initial?.newShiftId ?? employee?.shiftId ?? ''} className={selectClass}>
              <option value="">Keep employee shift</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="reason">Reason</Label>
            <textarea
              id="reason"
              name="reason"
              rows={3}
              defaultValue={initial?.reason ?? ''}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
            {state?.fieldErrors?.reason?.[0] ? <p className="text-xs text-destructive">{state.fieldErrors.reason[0]}</p> : null}
          </div>
        </div>
      </Section>

      <Section title="Attachment">
        <div className="space-y-2">
          <Label htmlFor="attachmentUrl">Attachment URL / file path</Label>
          <Input id="attachmentUrl" name="attachmentUrl" defaultValue={initial?.attachmentUrl ?? ''} placeholder="Gate pass, duty slip, memo, certificate, attendance sheet" />
        </div>
      </Section>

      <Section title="HR Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ReadOnlyField label="Adjusted By" value={initial?.adjustedBy ?? 'Current HR user'} />
          <ReadOnlyField label="Adjustment Date" value={initial?.attendanceDate ?? date} />
          <div className="space-y-2 xl:col-span-1">
            <Label htmlFor="remarks">Remarks</Label>
            <textarea
              id="remarks"
              name="remarks"
              rows={3}
              defaultValue={initial?.remarks ?? ''}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
          {pending ? 'Saving...' : 'Save Draft'}
        </Button>
        <Button type="submit" name="intent" value="apply" disabled={pending}>
          {pending ? 'Updating...' : 'Update Attendance'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/hr/attendance-adjustment">Cancel</Link>
        </Button>
        {initial?.id && initial.status === 'DRAFT' ? (
          <Button type="submit" formAction={cancelAttendanceAdjustmentAction} variant="destructive">
            Mark Cancelled
          </Button>
        ) : null}
        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </div>
    </form>
  );
}

export function AttendanceAdjustmentTable({ records, selectedId }: { records: AdjustmentRecord[]; selectedId?: string }) {
  if (records.length === 0) {
    return <div className="px-6 py-12 text-center text-muted-foreground">No attendance adjustments found.</div>;
  }

  return (
    <div className="space-y-3 p-4">
      {records.map((record) => (
        <Card key={record.id} className={selectedId === record.id ? 'border-primary' : undefined}>
          <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.1fr_1.4fr_1fr_1fr_1fr_1.6fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adjustment No</p>
              <p className="text-sm font-semibold text-primary">{record.adjustmentNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</p>
              <p className="text-sm font-semibold">{record.employeeName}</p>
              <p className="text-xs text-muted-foreground">{record.employeeCode}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</p>
              <p className="text-sm">{record.attendanceDate}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adjustment Type</p>
              <p className="text-sm">{ATTENDANCE_ADJUSTMENT_TYPE_LABELS[record.adjustmentType] ?? record.adjustmentType}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Change</p>
              <p className="text-sm">
                {ADJUSTMENT_STATUS_LABELS[record.oldStatus] ?? record.oldStatus} {'->'} {ADJUSTMENT_STATUS_LABELS[record.newStatus] ?? record.newStatus}
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(record.status)}>
                  {ATTENDANCE_ADJUSTMENT_STATUS_LABELS[record.status] ?? record.status}
                </Badge>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/hr/attendance-adjustment?edit=${record.id}&date=${record.attendanceDate}`}>Open</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Adjusted by {record.adjustedBy}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
