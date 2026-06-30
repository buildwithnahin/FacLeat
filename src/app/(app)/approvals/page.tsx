import Link from 'next/link';
import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { KpiCard } from '@/components/shared/kpi-card';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import { approvalService } from '@/server/services/approval.service';
import { getSession } from '@/server/auth/session';
import { APPROVAL_STATUS } from '@/server/validators/approvals';
import { prisma } from '@/server/db';
import { decideRecruitmentRequestAction } from '@/server/actions/hr-recruitment';

export const metadata = { title: 'Approvals' };

type PillTone = 'grey' | 'blue' | 'amber' | 'green' | 'red' | 'orange';
const TONE: Record<(typeof APPROVAL_STATUS)[number], PillTone> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'grey',
  CHANGES_REQUESTED: 'orange',
  ESCALATED: 'red',
};

interface Search {
  status?: string;
  scope?: string;
}

const RECRUITMENT_APPROVAL_ROLE_BY_STATUS: Record<string, string> = {
  'HR Review': 'HR',
  'Accounts Budget Check': 'Accounts',
  'Management Approval': 'Management',
};

const RECRUITMENT_STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  'HR Review': 'warning',
  'Accounts Budget Check': 'warning',
  'Management Approval': 'warning',
  Approved: 'success',
  Rejected: 'destructive',
  Cancelled: 'outline',
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const scope = sp.scope ?? 'for-me';
  const approverRoles = session?.roles ?? [];
  const canReviewRecruitment = approverRoles.some((role) =>
    ['HR', 'Accounts', 'Management', 'Admin', 'Super Admin'].includes(role),
  );
  const recruitmentStatusesForUser = Object.entries(RECRUITMENT_APPROVAL_ROLE_BY_STATUS)
    .filter(([, role]) => approverRoles.includes(role) || approverRoles.includes('Admin') || approverRoles.includes('Super Admin'))
    .map(([status]) => status);
  const [rows, stats] = await Promise.all([
    approvalService.list(session, {
      status: sp.status && sp.status !== 'ALL' ? sp.status : undefined,
      forMe: scope === 'for-me',
      mine: scope === 'mine',
    }),
    approvalService.queueStats(session),
  ]);
  const recruitmentApprovalRows = canReviewRecruitment
    ? await prisma.hrWorkflowRecord.findMany({
        where: {
          section: 'recruitment',
          status: {
            in: recruitmentStatusesForUser.length > 0 ? recruitmentStatusesForUser : Object.keys(RECRUITMENT_APPROVAL_ROLE_BY_STATUS),
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" description="Review, approve, reject, or request changes">
        <Button variant="outline" asChild>
          <Link href="/approvals/rules">
            <Settings className="h-4 w-4" /> Rules
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Pending" value={stats.pending} icon={Clock} tone="warning" />
        <KpiCard label="Approved" value={stats.approved} icon={CheckCircle2} tone="success" />
        <KpiCard label="Rejected" value={stats.rejected} icon={XCircle} tone="danger" />
      </div>

      <Card className="p-2 flex gap-2">
        <Button variant={scope === 'for-me' ? 'dark' : 'ghost'} size="sm" asChild>
          <Link href="/approvals?scope=for-me">For me</Link>
        </Button>
        <Button variant={scope === 'mine' ? 'dark' : 'ghost'} size="sm" asChild>
          <Link href="/approvals?scope=mine">My requests</Link>
        </Button>
        <Button variant={scope === 'all' ? 'dark' : 'ghost'} size="sm" asChild>
          <Link href="/approvals?scope=all">All</Link>
        </Button>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          {rows.length} request{rows.length === 1 ? '' : 's'}
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          empty="Nothing pending."
          columns={[
            {
              key: 'title',
              header: 'Title',
              cell: (r) => (
                <Link href={`/approvals/${r.id}`} className="text-blue-600 hover:underline">
                  {r.title}
                </Link>
              ),
            },
            {
              key: 'module',
              header: 'Scope',
              cell: (r) => (
                <span className="text-xs">
                  {r.module}:{r.action}
                </span>
              ),
            },
            {
              key: 'step',
              header: 'Current step',
              cell: (r) => {
                const active = r.steps.find((s) => s.status === 'ACTIVE');
                return active ? `${active.sequence}/${r.steps.length} — ${active.approverRole}` : '—';
              },
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (r) =>
                r.amount ? (
                  <span className="tabular">
                    {r.currency ?? ''} {r.amount.toString()}
                  </span>
                ) : (
                  '—'
                ),
            },
            {
              key: 'when',
              header: 'Submitted',
              cell: (r) => (
                <span className="tabular text-xs">
                  {r.createdAt.toISOString().slice(0, 10)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={TONE[r.status]}>{r.status.replace('_', ' ').toLowerCase()}</Pill>
              ),
            },
          ]}
        />
      </Card>

      {canReviewRecruitment && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b">
            <div className="text-sm font-medium">Recruitment Approvals</div>
            <p className="text-xs text-muted-foreground">Manager and role-based hiring requests waiting for decision.</p>
          </div>
          <div className="overflow-x-hidden">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-[14%] px-4 py-3 text-left font-semibold">Request No</th>
                  <th className="w-[14%] px-4 py-3 text-left font-semibold">Department</th>
                  <th className="w-[16%] px-4 py-3 text-left font-semibold">Position</th>
                  <th className="w-[10%] px-4 py-3 text-right font-semibold">Vacancies</th>
                  <th className="w-[12%] px-4 py-3 text-left font-semibold">Salary Range</th>
                  <th className="w-[12%] px-4 py-3 text-left font-semibold">Joining</th>
                  <th className="w-[10%] px-4 py-3 text-left font-semibold">Status</th>
                  <th className="w-[12%] px-4 py-3 text-left font-semibold">Approver</th>
                  <th className="w-[16%] px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recruitmentApprovalRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No recruitment approvals are waiting for your role.
                    </td>
                  </tr>
                ) : (
                  recruitmentApprovalRows.map((row) => {
                    const meta = (row.metadata as Record<string, any>) || {};
                    const currentRole = RECRUITMENT_APPROVAL_ROLE_BY_STATUS[row.status] ?? '—';
                    const canActOnRow =
                      approverRoles.includes(currentRole) ||
                      approverRoles.includes('Admin') ||
                      approverRoles.includes('Super Admin');

                    return (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-primary break-words">
                          <Link href="/hr/recruitment" className="hover:underline">
                            {meta.requestNo || 'REC-XXXX-XXXX'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 break-words font-medium">{row.subject}</td>
                        <td className="px-4 py-3 break-words">{row.title}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{Number(row.amount || 0)}</td>
                        <td className="px-4 py-3 break-words text-muted-foreground">{row.owner || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.startDate ? row.startDate.toISOString().slice(0, 10) : '—'}</td>
                        <td className="px-4 py-3">
                          <Badge className="max-w-full whitespace-normal break-words leading-tight" variant={RECRUITMENT_STATUS_VARIANT[row.status] || 'outline'}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{currentRole}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col items-stretch gap-2">
                            <RecruitmentApprovalAction
                              id={row.id}
                              decision="Approved"
                              label={`${currentRole} approve`}
                              disabled={!canActOnRow}
                            />
                            <RecruitmentApprovalAction
                              id={row.id}
                              decision="Rejected"
                              label="Reject"
                              danger
                              disabled={!canActOnRow}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function RecruitmentApprovalAction({
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
