import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { ShiftForm } from '../../shift-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit Shift' };

interface ShiftDetail {
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
}

interface FormOptions {
  branches: { id: string; code: string; name: string }[];
}

export default async function EditShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let shift: ShiftDetail;
  try {
    shift = await backendFetch<ShiftDetail>(`/api/mobile/hr/shifts/${id}`);
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) notFound();
    throw error;
  }

  const { branches } = await backendFetch<FormOptions>('/api/mobile/hr/shifts/form-options');

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${shift.name}`} description="Update working hours, attendance thresholds, and overtime rules." />
      <ShiftForm mode="edit" branches={branches} initial={shift} />
    </div>
  );
}
