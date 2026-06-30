import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { holidaysService } from '@/server/services/holidays.service';
import { NotFoundError } from '@/lib/errors';
import { PageHeader } from '@/components/shared/page-header';
import { HolidayForm } from '../../holiday-form';

export const metadata = { title: 'Edit Holiday' };

export default async function EditHolidayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  await authorize(session, 'hr:write');

  let holiday;
  try {
    holiday = await holidaysService.getById(session, id);
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
        title={`Edit ${holiday.name}`}
        description="Update holiday details used by attendance, leave, and payroll rules."
      />
      <HolidayForm
        mode="edit"
        branches={branches}
        initial={{
          id: holiday.id,
          name: holiday.name,
          code: holiday.code,
          startDate: holiday.startDate.toISOString().slice(0, 10),
          endDate: holiday.endDate.toISOString().slice(0, 10),
          type: holiday.type,
          branchId: holiday.branchId,
          isPaid: holiday.isPaid,
          status: holiday.status,
          description: holiday.description,
        }}
      />
    </div>
  );
}
