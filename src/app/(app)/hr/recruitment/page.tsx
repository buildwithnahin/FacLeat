import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { buildDesignationOptions } from '@/lib/hr-master-data';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NewRequestForm } from './_components/new-request-form';
import { decideRecruitmentRequestAction } from '@/server/actions/hr-recruitment';
import { ClipboardList, Briefcase, Calendar, UserCheck, AlertCircle } from 'lucide-react';
import { ForbiddenError } from '@/lib/errors';

export const metadata = { title: 'Recruitment Requests' };

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  'Pending Approval': 'warning',
  'HR Review': 'warning',
  'Accounts Budget Check': 'warning',
  'Management Approval': 'warning',
  Approved: 'success',
  Rejected: 'destructive',
  Cancelled: 'outline',
};

const RECRUITMENT_APPROVAL_STEPS: Record<string, { role: string; next: string }> = {
  'HR Review': { role: 'HR', next: 'Accounts Budget Check' },
  'Accounts Budget Check': { role: 'Accounts', next: 'Management Approval' },
  'Management Approval': { role: 'Management', next: 'Approved' },
};

function canApproveStep(roles: string[], status: string) {
  const step = RECRUITMENT_APPROVAL_STEPS[status];
  if (!step) return false;
  return roles.includes(step.role) || roles.includes('Admin') || roles.includes('Super Admin');
}

function canAccessRecruitment(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return false;
  return (
    session.permissions.includes('hr:read') ||
    session.permissions.includes('accounts:read') ||
    (session.roles ?? []).some((role) => ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'].includes(role))
  );
}

export default async function RecruitmentRequestsPage() {
  const session = await getSession();
  if (!canAccessRecruitment(session)) {
    throw new ForbiddenError('Missing permission: hr:read or accounts:read');
  }

  const canCreate = session?.permissions.includes('hr:write') ?? false;
  const canReview = (session?.roles ?? []).some((role) =>
    ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'].includes(role),
  );

  const [requests, departments, designations] = await Promise.all([
    prisma.hrWorkflowRecord.findMany({
      where: { section: 'recruitment' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.hrMasterData.findMany({
      where: { type: 'departments', status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.hrMasterData.findMany({
      where: { type: 'designations', status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { name: true, metadata: true },
    }),
  ]);

  const pendingCount = requests.filter((r) => r.status === 'Pending Approval').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruitment Requests"
        description="Departmental manpower hiring requests and approval logs."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Requests</p>
              <p className="mt-2 text-2xl font-bold">{requests.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending Approval</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Approved Vacancies</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{approvedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {canCreate && (
        <Card className="shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              New Manpower Request Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NewRequestForm
              departments={departments.map((department) => department.name)}
              designationOptions={buildDesignationOptions(designations)}
            />
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b px-6 py-4 bg-muted/20">
          <div className="font-semibold text-sm">Hiring Requests Register</div>
        </div>
        <div className="overflow-x-hidden">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-[13%] text-left font-semibold px-4 py-3">Request No</th>
                <th className="w-[12%] text-left font-semibold px-4 py-3">Department</th>
                <th className="w-[15%] text-left font-semibold px-4 py-3">Position</th>
                <th className="w-[9%] text-right font-semibold px-4 py-3">Vacancies</th>
                <th className="w-[13%] text-left font-semibold px-4 py-3">Salary Range</th>
                <th className="w-[12%] text-left font-semibold px-4 py-3">Expected Joining</th>
                <th className="w-[10%] text-left font-semibold px-4 py-3">Priority</th>
                <th className="w-[11%] text-left font-semibold px-4 py-3">Status</th>
                {canReview && <th className="w-[15%] text-right font-semibold px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={canReview ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground">
                    No recruitment requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const meta = (r.metadata as Record<string, unknown> | null) ?? {};
                  const step = RECRUITMENT_APPROVAL_STEPS[r.status];
                  const canApprove = canApproveStep(session?.roles ?? [], r.status);
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-primary break-words">
                        {meta.requestNo || 'REC-XXXX-XXXX'}
                      </td>
                      <td className="px-4 py-3 font-medium break-words">{r.subject}</td>
                      <td className="px-4 py-3 break-words">{r.title}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{Number(r.amount || 0)}</td>
                      <td className="px-4 py-3 text-muted-foreground break-words">{r.owner || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex items-start gap-1.5">
                          <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="break-words">{r.startDate ? r.startDate.toISOString().slice(0, 10) : '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className="max-w-full whitespace-normal break-words leading-tight"
                          variant={r.priority === 'HIGH' || r.priority === 'URGENT' ? 'destructive' : 'outline'}
                        >
                          {r.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="max-w-full whitespace-normal break-words leading-tight" variant={STATUS_VARIANT[r.status] || 'outline'}>
                          {r.status}
                        </Badge>
                      </td>
                      {canReview && (
                        <td className="px-4 py-3 align-top">
                          {step ? (
                            <div className="flex flex-col items-stretch gap-2">
                              <DecideRequestForm
                                id={r.id}
                                decision="Approved"
                                label={`${step.role} approve`}
                                disabled={!canApprove}
                              />
                              <DecideRequestForm id={r.id} decision="Rejected" label="Reject" danger disabled={!canApprove} />
                            </div>
                          ) : (
                            <div className="text-right text-xs text-muted-foreground italic">Processed</div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function DecideRequestForm({
  id,
  decision,
  label,
  danger,
  disabled,
}: {
  id: string;
  decision: 'Approved' | 'Rejected';
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  async function action() {
    'use server';
    await decideRecruitmentRequestAction(id, decision);
  }
  return (
    <form action={action}>
      <Button
        type="submit"
        size="sm"
        className="w-full whitespace-normal break-words text-center leading-tight"
        variant={danger ? 'destructive' : 'outline'}
        disabled={disabled}
      >
        {label}
      </Button>
    </form>
  );
}
