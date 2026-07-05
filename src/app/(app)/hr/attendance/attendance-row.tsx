'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { markAttendanceAction } from '@/server/actions/hr';
import { ATTENDANCE_STATUSES } from '@/server/validators/hr';
import { toast } from 'sonner';

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  PRESENT: 'success',
  LATE: 'warning',
  HALF_DAY: 'warning',
  ABSENT: 'destructive',
  ON_LEAVE: 'default',
  HOLIDAY: 'outline',
};

export function AttendanceRow({
  employee,
  record,
  otDisplay: initialOtDisplay,
  holiday,
  dateStr,
  canMark,
}: {
  employee: any;
  record: any;
  otDisplay?: string;
  holiday: any;
  dateStr: string;
  canMark: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [checkIn, setCheckIn] = useState(record?.checkIn || '');
  const [checkOut, setCheckOut] = useState(record?.checkOut || '');
  const [status, setStatus] = useState(record?.status ?? (holiday ? 'HOLIDAY' : 'PRESENT'));

  let otDisplay = initialOtDisplay || '-';
  if (checkIn && checkOut) {
    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    if (!isNaN(inH) && !isNaN(inM) && !isNaN(outH) && !isNaN(outM)) {
      const diffHours = (outH + outM / 60) - (inH + inM / 60);
      if (holiday) {
        otDisplay = `${Math.max(0, diffHours).toFixed(1)} hrs (Holiday OT)`;
      } else {
        otDisplay = `${Math.max(0, diffHours).toFixed(1)} hrs`;
      }
    }
  }

  const handleSave = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('employeeId', employee.id);
      formData.append('date', dateStr);
      formData.append('status', status);
      formData.append('checkIn', checkIn);
      formData.append('checkOut', checkOut);

      await markAttendanceAction(formData);
      toast.success('Attendance saved for ' + employee.firstName);
    });
  };

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-3 font-mono text-xs">{employee.code}</td>
      <td className="px-3 py-3 font-medium">
        {employee.firstName} {employee.lastName}
      </td>
      <td className="px-3 py-3">
        {canMark ? (
          <input
            type="time"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
          />
        ) : (
          <span className="font-mono text-xs">{checkIn || '-'}</span>
        )}
      </td>
      <td className="px-3 py-3">
        {canMark ? (
          <input
            type="time"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
          />
        ) : (
          <span className="font-mono text-xs">{checkOut || '-'}</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs font-medium text-primary">{otDisplay}</td>
      <td className="px-3 py-3">
        {canMark ? (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : record ? (
          <Badge variant={STATUS_VARIANT[record.status] ?? 'outline'}>{record.status}</Badge>
        ) : holiday ? (
          <Badge variant="outline">HOLIDAY</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Not marked</span>
        )}
      </td>
      {canMark && (
        <td className="px-3 py-3">
          <Button
            onClick={handleSave}
            disabled={isPending}
            size="sm"
            variant="outline"
            className="w-full"
          >
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </td>
      )}
    </tr>
  );
}
