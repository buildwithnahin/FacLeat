import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { ShiftForm } from '../shift-form';

export const metadata = { title: 'New Shift' };

export default async function NewShiftPage() {
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
        title="New Shift"
        description="Create a practical shift rule set for attendance, overtime, and payroll processing."
      />
      <ShiftForm mode="create" branches={branches} />
    </div>
  );
}
