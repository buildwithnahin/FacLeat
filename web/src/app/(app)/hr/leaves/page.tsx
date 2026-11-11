import { getSession } from '@/server/auth/session';
import { PageHeader } from '@/components/shared/page-header';
import { backendFetch } from '@/lib/backend-client';
import { NewLeaveForm } from './_components/new-leave-form';
import { LeaveTable, type LeaveRequestItem } from './_components/leave-table';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Leave Application' };

interface EmployeeDetail {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  department: string | null;
  designation: string | null;
  joiningDate: string;
  employmentType: string | null;
  branch: { id: string; name: string } | null;
}

interface LeaveTypeOption {
  code: string;
}

interface FormDataResponse {
  employees: EmployeeDetail[];
  leaveTypes: LeaveTypeOption[];
}

export default async function LeavesPage() {
  const session = await getSession();

  const [formData, leaves] = await Promise.all([
    backendFetch<FormDataResponse>('/api/mobile/hr/leaves/form-data'),
    backendFetch<LeaveRequestItem[]>('/api/mobile/hr/leaves'),
  ]);

  const canCreate = session?.permissions.includes('hr:write') ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Application"
        description="Submit leave requests, check available balances, and track approval states."
      />

      {canCreate && (
        <NewLeaveForm
          employees={formData.employees}
          types={formData.leaveTypes.map((type) => type.code)}
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
