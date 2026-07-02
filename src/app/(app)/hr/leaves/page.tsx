import { getSession } from '@/server/auth/session';
import { PageHeader } from '@/components/shared/page-header';
import { leavesService } from '@/server/services/leaves.service';
import { prisma } from '@/server/db';
import { LEAVE_TYPES } from '@/server/validators/hr';
import { NewLeaveForm } from './_components/new-leave-form';
import { LeaveTable } from './_components/leave-table';

export const metadata = { title: 'Leave Application' };

export default async function LeavesPage() {
  const session = await getSession();
  
  // Fetch active employees with full details for client-side populate
  const employeesResult = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      department: true,
      designation: true,
      joinedAt: true,
      employmentType: true,
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ firstName: 'asc' }],
  });

  const employees = employeesResult.map((emp) => ({
    id: emp.id,
    code: emp.code,
    firstName: emp.firstName,
    lastName: emp.lastName,
    department: emp.department,
    designation: emp.designation,
    joiningDate: emp.joinedAt.toISOString(),
    employmentType: emp.employmentType,
    branch: emp.branch,
  }));

  const leaves = await leavesService.list(session);

  const canCreate = session?.permissions.includes('hr:write') ?? false;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Leave Application" 
        description="Submit leave requests, check available balances, and track approval states." 
      />

      {canCreate && (
        <NewLeaveForm
          employees={employees}
          types={[...LEAVE_TYPES]}
        />
      )}

      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
          Leave Application Registry
        </h3>
        <LeaveTable 
          leaves={leaves} 
          mode="application"
          allowWithdraw={canCreate}
        />
      </div>
    </div>
  );
}
