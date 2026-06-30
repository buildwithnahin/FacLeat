import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { HolidayForm } from '../holiday-form';

export const metadata = { title: 'New Holiday' };

export default async function NewHolidayPage() {
  const session = await getSession();
  await authorize(session, 'hr:write');

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Holiday"
        description="Create branch-wide or branch-specific holidays for attendance, leave, and payroll logic."
      />
      <HolidayForm mode="create" branches={branches} />
    </div>
  );
}
