import { getSession } from '@/server/auth/session';
import { hrService } from '@/server/services/hr.service';
import { holidaysService } from '@/server/services/holidays.service';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AttendanceRow } from './attendance-row';

export const metadata = { title: 'Attendance' };

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  PRESENT: 'success',
  LATE: 'warning',
  HALF_DAY: 'warning',
  ABSENT: 'destructive',
  ON_LEAVE: 'default',
  HOLIDAY: 'outline',
};

function formatTimeValue(value?: Date | null) {
  if (!value) return '';
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const dateStr = sp.date ?? new Date().toISOString().slice(0, 10);
  const day = new Date(dateStr);
  const session = await getSession();
  const [employees, records, holidays] = await Promise.all([
    hrService.listEmployees(session, { status: 'ACTIVE' }),
    hrService.listAttendance(session, { from: day, to: day }),
    holidaysService.listOnDate(session, day),
  ]);
  const canMark = session?.permissions.includes('hr:attendance') ?? false;
  const byEmp = new Map(records.map((r) => [r.employeeId, r]));

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description={`Daily attendance for ${dateStr}`}>
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="date"
            defaultValue={dateStr}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          />
          <Button type="submit" variant="outline">Go</Button>
        </form>
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              {canMark ? (
                <>
                  <col className="w-[9%]" />
                  <col className="w-[19%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[17%]" />
                  <col className="w-[9%]" />
                </>
              ) : (
                <>
                  <col className="w-[12%]" />
                  <col className="w-[24%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                </>
              )}
            </colgroup>
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Code</th>
                <th className="px-3 py-3 text-left font-semibold">Employee</th>
                <th className="px-3 py-3 text-left font-semibold">Check-in</th>
                <th className="px-3 py-3 text-left font-semibold">Check-out</th>
                <th className="px-3 py-3 text-left font-semibold">OT / Worked Hours</th>
                <th className="px-3 py-3 text-left font-semibold">Status</th>
                {canMark && <th className="px-3 py-3 text-left font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.length === 0 && (
                <tr>
                  <td colSpan={canMark ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                    No active employees.
                  </td>
                </tr>
              )}
              {employees.map((e) => {
                const r = byEmp.get(e.id);
                const formId = `attendance-row-${e.id}`;
                const holiday = holidays.find(
                  (h) => h.branchId === null || h.branchId === e.branchId,
                );
                
                let otDisplay = '-';
                if (r?.checkIn && r?.checkOut) {
                  const diffHours = (r.checkOut.getTime() - r.checkIn.getTime()) / (1000 * 60 * 60);
                  if (holiday) {
                    otDisplay = `${Math.max(0, diffHours).toFixed(1)} hrs (Holiday OT)`;
                  } else {
                    otDisplay = `${Math.max(0, diffHours).toFixed(1)} hrs`;
                  }
                }

                return (
                  <AttendanceRow
                    key={e.id}
                    employee={{
                      id: e.id,
                      code: e.code,
                      firstName: e.firstName,
                      lastName: e.lastName,
                    }}
                    record={
                      r
                        ? {
                            id: r.id,
                            status: r.status,
                            checkIn: formatTimeValue(r.checkIn),
                            checkOut: formatTimeValue(r.checkOut),
                          }
                        : null
                    }
                    otDisplay={otDisplay}
                    holiday={holiday}
                    dateStr={dateStr}
                    canMark={canMark}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
