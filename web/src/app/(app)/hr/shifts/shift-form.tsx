'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { createShiftAction, updateShiftAction, type ShiftFormState } from '@/server/actions/shifts';
import { SHIFT_STATUSES, SHIFT_TYPES, WEEK_DAYS } from '@/server/validators/shifts';

const SHIFT_TYPE_LABELS: Record<(typeof SHIFT_TYPES)[number], string> = {
  DAY: 'Day Shift',
  NIGHT: 'Night Shift',
  ROTATIONAL: 'Rotational Shift',
  FLEXIBLE: 'Flexible Shift',
};

const WEEK_DAY_LABELS: Record<(typeof WEEK_DAYS)[number], string> = {
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
};

function toMinutes(value: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function durationMinutes(start: string, end: string) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;
  return endMinutes >= startMinutes ? endMinutes - startMinutes : 24 * 60 - startMinutes + endMinutes;
}

function formatMinutes(value: number | null) {
  if (value === null) return '—';
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

export interface ShiftFormProps {
  mode: 'create' | 'edit';
  branches: { id: string; name: string; code: string }[];
  initial?: {
    id: string;
    branchId: string;
    name: string;
    code: string;
    status: string;
    description: string | null;
    shiftType: string;
    startTime: string;
    endTime: string;
    breakStart: string | null;
    breakEnd: string | null;
    lateGraceMinutes: number;
    earlyExitGraceMinutes: number;
    minPresentMinutes: number;
    minHalfDayMinutes: number;
    absentBelowMinutes: number;
    overtimeAllowed: boolean;
    otStartsAfter: string | null;
    minOtMinutes: number;
    maxOtMinutesPerDay: number;
    weeklyOffDays: string[];
  };
}

export function ShiftForm({ mode, branches, initial }: ShiftFormProps) {
  const action = mode === 'create' ? createShiftAction : updateShiftAction;
  const [state, formAction, pending] = useActionState<ShiftFormState, FormData>(action, undefined);
  const E = (field: string) => state?.fieldErrors?.[field]?.[0];

  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '18:00');
  const [breakStart, setBreakStart] = useState(initial?.breakStart ?? '13:00');
  const [breakEnd, setBreakEnd] = useState(initial?.breakEnd ?? '14:00');
  const [overtimeAllowed, setOvertimeAllowed] = useState(initial?.overtimeAllowed ?? true);

  const totalWorkingHours = useMemo(() => {
    const shiftMinutes = durationMinutes(startTime, endTime);
    const breakMinutes = breakStart && breakEnd ? durationMinutes(breakStart, breakEnd) : 0;
    if (shiftMinutes === null) return null;
    return Math.max(0, shiftMinutes - (breakMinutes ?? 0));
  }, [breakEnd, breakStart, endTime, startTime]);

  return (
    <form action={formAction} className="space-y-6">
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">
              Shift Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" required defaultValue={initial?.name} />
            {E('name') && <p className="text-xs text-destructive">{E('name')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">
              Shift Code <span className="text-destructive">*</span>
            </Label>
            <Input id="code" name="code" required defaultValue={initial?.code} />
            {E('code') && <p className="text-xs text-destructive">{E('code')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchId">
              Branch <span className="text-destructive">*</span>
            </Label>
            <select
              id="branchId"
              name="branchId"
              required
              defaultValue={initial?.branchId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} · {branch.name}
                </option>
              ))}
            </select>
            {E('branchId') && <p className="text-xs text-destructive">{E('branchId')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">
              Status <span className="text-destructive">*</span>
            </Label>
            <select
              id="status"
              name="status"
              defaultValue={initial?.status ?? 'ACTIVE'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {SHIFT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} defaultValue={initial?.description ?? ''} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="shiftType">
              Shift Type <span className="text-destructive">*</span>
            </Label>
            <select
              id="shiftType"
              name="shiftType"
              defaultValue={initial?.shiftType ?? 'DAY'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {SHIFT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SHIFT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startTime">
              Start Time <span className="text-destructive">*</span>
            </Label>
            <Input id="startTime" name="startTime" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            {E('startTime') && <p className="text-xs text-destructive">{E('startTime')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">
              End Time <span className="text-destructive">*</span>
            </Label>
            <Input id="endTime" name="endTime" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            {E('endTime') && <p className="text-xs text-destructive">{E('endTime')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="breakStart">Break Start</Label>
            <Input id="breakStart" name="breakStart" type="time" value={breakStart} onChange={(event) => setBreakStart(event.target.value)} />
            {E('breakStart') && <p className="text-xs text-destructive">{E('breakStart')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="breakEnd">Break End</Label>
            <Input id="breakEnd" name="breakEnd" type="time" value={breakEnd} onChange={(event) => setBreakEnd(event.target.value)} />
            {E('breakEnd') && <p className="text-xs text-destructive">{E('breakEnd')}</p>}
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Working Hours</p>
            <p className="mt-2 text-xl font-semibold">{formatMinutes(totalWorkingHours)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Auto calculated from start/end minus break.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="lateGraceMinutes">Late Grace Time (minutes)</Label>
            <Input id="lateGraceMinutes" name="lateGraceMinutes" type="number" min="0" defaultValue={initial?.lateGraceMinutes ?? 15} />
            {E('lateGraceMinutes') && <p className="text-xs text-destructive">{E('lateGraceMinutes')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="earlyExitGraceMinutes">Early Exit Grace (minutes)</Label>
            <Input id="earlyExitGraceMinutes" name="earlyExitGraceMinutes" type="number" min="0" defaultValue={initial?.earlyExitGraceMinutes ?? 10} />
            {E('earlyExitGraceMinutes') && <p className="text-xs text-destructive">{E('earlyExitGraceMinutes')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="minPresentMinutes">Minimum Hours for Present</Label>
            <Input id="minPresentMinutes" name="minPresentMinutes" type="number" min="1" defaultValue={initial?.minPresentMinutes ?? 480} />
            {E('minPresentMinutes') && <p className="text-xs text-destructive">{E('minPresentMinutes')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="minHalfDayMinutes">Minimum Hours for Half Day</Label>
            <Input id="minHalfDayMinutes" name="minHalfDayMinutes" type="number" min="1" defaultValue={initial?.minHalfDayMinutes ?? 240} />
            {E('minHalfDayMinutes') && <p className="text-xs text-destructive">{E('minHalfDayMinutes')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="absentBelowMinutes">Absent If Less Than</Label>
            <Input id="absentBelowMinutes" name="absentBelowMinutes" type="number" min="0" defaultValue={initial?.absentBelowMinutes ?? 240} />
            {E('absentBelowMinutes') && <p className="text-xs text-destructive">{E('absentBelowMinutes')}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          <div className="md:col-span-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="overtimeAllowed"
                checked={overtimeAllowed}
                onChange={(event) => setOvertimeAllowed(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium">Allow overtime</span>
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="otStartsAfter">OT Starts After</Label>
            <Input id="otStartsAfter" name="otStartsAfter" type="time" defaultValue={initial?.otStartsAfter ?? initial?.endTime ?? '18:00'} disabled={!overtimeAllowed} />
            {E('otStartsAfter') && <p className="text-xs text-destructive">{E('otStartsAfter')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="minOtMinutes">Minimum OT (minutes)</Label>
            <Input id="minOtMinutes" name="minOtMinutes" type="number" min="0" defaultValue={initial?.minOtMinutes ?? 30} disabled={!overtimeAllowed} />
            {E('minOtMinutes') && <p className="text-xs text-destructive">{E('minOtMinutes')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxOtMinutesPerDay">Maximum OT Per Day (minutes)</Label>
            <Input id="maxOtMinutesPerDay" name="maxOtMinutesPerDay" type="number" min="0" defaultValue={initial?.maxOtMinutesPerDay ?? 240} disabled={!overtimeAllowed} />
            {E('maxOtMinutesPerDay') && <p className="text-xs text-destructive">{E('maxOtMinutesPerDay')}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-sm font-semibold">Weekly Off</p>
            <p className="text-xs text-muted-foreground">Select the weekly off days for this shift.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {WEEK_DAYS.map((day) => {
              const checked = initial?.weeklyOffDays?.includes(day) ?? (day === 'FRIDAY');
              return (
                <label key={day} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <input type="checkbox" name="weeklyOffDays" value={day} defaultChecked={checked} className="h-4 w-4 accent-primary" />
                  <span>{WEEK_DAY_LABELS[day]}</span>
                </label>
              );
            })}
          </div>
          {E('weeklyOffDays') && <p className="text-xs text-destructive">{E('weeklyOffDays')}</p>}
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Save Shift' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/hr/shifts">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
