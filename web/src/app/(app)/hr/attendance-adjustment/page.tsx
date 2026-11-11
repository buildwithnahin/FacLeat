import { ClipboardCheck, TimerReset } from 'lucide-react';
import { backendFetch } from '@/lib/backend-client';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AttendanceAdjustmentForm, AttendanceAdjustmentTable } from './attendance-adjustment-components';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Attendance Adjustment - HR' };

interface AdjustmentBundle {
  selectedDate: string;
  tableUnavailable: boolean;
  tableUnavailableMessage: string | null;
  employeeOptions: {
    id: string;
    label: string;
    employeeCode: string;
    branch: string;
    department: string;
    designation: string;
    shiftId: string;
    shiftName: string;
  }[];
  shiftOptions: { id: string; label: string }[];
  attendanceByEmployee: Record<string, { checkIn: string; checkOut: string; status: string; workedHours: string; otHours: string }>;
  records: Array<{
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
  }>;
  editRecord: AdjustmentBundle['records'][number] | null;
}

export default async function AttendanceAdjustmentPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; date?: string; error?: string; status?: string; q?: string }>;
}) {
  const { edit, date, error, status, q } = await searchParams;

  const params = new URLSearchParams();
  if (edit) params.set('edit', edit);
  if (date) params.set('date', date);
  if (status) params.set('status', status);
  if (q) params.set('q', q);

  const { selectedDate, tableUnavailable, tableUnavailableMessage, employeeOptions, shiftOptions, attendanceByEmployee, records, editRecord } =
    await backendFetch<AdjustmentBundle>(`/api/mobile/hr/attendance-adjustments?${params.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Adjustment"
        description="Correct missed punches, shift mismatches, official duty, holiday work, and other attendance errors without an approval chain."
      >
        <form className="flex items-center gap-2">
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          />
          <button type="submit" className="rounded-md border px-3 py-2 text-sm">
            Go
          </button>
        </form>
      </PageHeader>

      {tableUnavailable ? (
        <AlertBanner tone="warning" title="Attendance adjustment migration required">
          {tableUnavailableMessage}
        </AlertBanner>
      ) : null}

      {error ? (
        <AlertBanner tone="warning" title="Attendance adjustment blocked">
          {error}
        </AlertBanner>
      ) : null}

      {!tableUnavailable ? (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Attendance Adjustment Form
            </div>
            <AttendanceAdjustmentForm
              employees={employeeOptions}
              shifts={shiftOptions}
              snapshots={attendanceByEmployee}
              date={selectedDate}
              initial={editRecord}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TimerReset className="h-4 w-4 text-primary" />
              Attendance Adjustment Records
            </div>
          </div>
          <AttendanceAdjustmentTable records={records} selectedId={editRecord?.id} />
        </CardContent>
      </Card>
    </div>
  );
}
