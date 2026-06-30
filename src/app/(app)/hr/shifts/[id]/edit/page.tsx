import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { shiftsService } from '@/server/services/shifts.service';
import { NotFoundError } from '@/lib/errors';
import { PageHeader } from '@/components/shared/page-header';
import { ShiftForm } from '../../shift-form';

export const metadata = { title: 'Edit Shift' };

export default async function EditShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  await authorize(session, 'hr:write');

  let shift;
  try {
    shift = await shiftsService.getById(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${shift.name}`}
        description="Update working hours, attendance thresholds, and overtime rules."
      />
      <ShiftForm
        mode="edit"
        branches={branches}
        initial={{
          id: shift.id,
          branchId: shift.branchId,
          name: shift.name,
          code: shift.code,
          status: shift.status,
          description: shift.description,
          shiftType: shift.shiftType,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakStart: shift.breakStart,
          breakEnd: shift.breakEnd,
          lateGraceMinutes: shift.lateGraceMinutes,
          earlyExitGraceMinutes: shift.earlyExitGraceMinutes,
          minPresentMinutes: shift.minPresentMinutes,
          minHalfDayMinutes: shift.minHalfDayMinutes,
          absentBelowMinutes: shift.absentBelowMinutes,
          overtimeAllowed: shift.overtimeAllowed,
          otStartsAfter: shift.otStartsAfter,
          minOtMinutes: shift.minOtMinutes,
          maxOtMinutesPerDay: shift.maxOtMinutesPerDay,
          weeklyOffDays: Array.isArray(shift.weeklyOffDays) ? shift.weeklyOffDays.map(String) : [],
        }}
      />
    </div>
  );
}
