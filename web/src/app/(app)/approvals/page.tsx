import Link from 'next/link';
import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { KpiCard } from '@/components/shared/kpi-card';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { APPROVAL_STATUS } from '@/server/validators/approvals';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Approvals' };

// The root implementation also surfaces an HR-recruitment approval queue
// here (prisma.hrWorkflowRecord + decideRecruitmentRequestAction). The HR
// module hasn't been migrated to web/ yet, so that section is intentionally
// left out of this pass rather than faked against a non-existent backend
// route — re-add once HR ships its own mobile API surface.

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

interface ApprovalStep {
  id: string;
  sequence: number;
  approverRole: string;
  status: string;
}

interface ApprovalRow {
  id: string;
  title: string;
  module: string;
  action: string;
  status: (typeof APPROVAL_STATUS)[number];
  amount: string | null;
  currency: string | null;
  createdAt: string;
  steps: ApprovalStep[];
}

interface QueueStats {
  pending: number;
  approved: number;
  rejected: number;
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const scope = sp.scope ?? 'for-me';

  const listParams = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') listParams.set('status', sp.status);
  if (scope === 'for-me') listParams.set('forMe', '1');
  if (scope === 'mine') listParams.set('mine', '1');

  const [rows, stats] = await Promise.all([
    backendFetch<ApprovalRow[]>(`/api/mobile/approvals?${listParams.toString()}`),
    backendFetch<QueueStats>('/api/mobile/approvals/queue-stats'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" description="Review, approve, reject, or request changes">
        {session?.permissions.includes('approvals:configure') && (
          <Button variant="outline" asChild>
            <Link href="/approvals/rules">
              <Settings className="h-4 w-4" /> Rules
            </Link>
          </Button>
        )}
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
                    {r.currency ?? ''} {r.amount}
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
                  {new Date(r.createdAt).toISOString().slice(0, 10)}
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
    </div>
  );
}
