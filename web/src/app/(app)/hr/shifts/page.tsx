import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Shifts' };

interface ShiftRow {
  id: string;
  name: string;
  code: string;
  status: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  minPresentMinutes: number;
  minHalfDayMinutes: number;
  weeklyOffDays: string[];
  branch: { code: string; name: string };
  employeeCount: number;
}

function formatTime(value: string) {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  if (Number.isNaN(hour) || !minute) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 || 12;
  return `${String(normalizedHour).padStart(2, '0')}:${minute} ${suffix}`;
}

function formatTimeRange(start: string, end: string) {
  return `${formatTime(start)}–${formatTime(end)}`;
}

function shiftTypeLabel(value: string) {
  switch (value) {
    case 'DAY':
      return 'Day';
    case 'NIGHT':
      return 'Night';
    case 'ROTATIONAL':
      return 'Rotational';
    case 'FLEXIBLE':
      return 'Flexible';
    default:
      return value;
  }
}

export default async function ShiftsPage() {
  const session = await getSession();
  const shifts = await backendFetch<ShiftRow[]>('/api/mobile/hr/shifts');
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts"
        description="Define working hours, attendance thresholds, overtime windows, and weekly off rules."
      >
        {canWrite && (
          <Button asChild>
            <Link href="/hr/shifts/new">
              <Plus className="h-4 w-4" />
              New shift
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Code</th>
                <th className="px-4 py-3 text-left font-semibold">Time</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Branch</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Weekly Off</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No shifts configured yet.
                  </td>
                </tr>
              )}
              {shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{shift.name}</div>
                    <div className="text-xs text-muted-foreground">{shift.employeeCount} employee(s) assigned</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{shift.code}</td>
                  <td className="px-4 py-3">
                    <div>{formatTimeRange(shift.startTime, shift.endTime)}</div>
                    <div className="text-xs text-muted-foreground">
                      Present after {Math.floor(shift.minPresentMinutes / 60)}h, half-day after {Math.floor(shift.minHalfDayMinutes / 60)}h
                    </div>
                  </td>
                  <td className="px-4 py-3">{shiftTypeLabel(shift.shiftType)}</td>
                  <td className="px-4 py-3">
                    {shift.branch.name} <span className="text-xs text-muted-foreground">({shift.branch.code})</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={shift.status === 'ACTIVE' ? 'success' : 'outline'}>{shift.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {shift.weeklyOffDays.length ? shift.weeklyOffDays.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite && (
                      <div className="flex items-center justify-end">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/hr/shifts/${shift.id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
