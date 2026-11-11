import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { ReconcileForm } from './reconcile-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'E-commerce Reconciliation' };

const STATUS_TONE: Record<string, PillTone> = {
  DRAFT: 'grey',
  COMPLETED: 'green',
};

interface Channel {
  id: string;
  name: string;
}

interface ReconciliationRun {
  id: string;
  channel: { name: string };
  periodStart: string;
  periodEnd: string;
  matchedCount: number;
  unmatchedCount: number;
  totalSettled: string;
  status: string;
}

export default async function EcommerceReconcilePage() {
  const session = await getSession();
  const branchId = session?.activeBranchId ?? undefined;
  const { channels, runs } = await backendFetch<{ channels: Channel[]; runs: ReconciliationRun[] }>(
    '/api/mobile/ecommerce/reconcile',
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Reconciliation" description="Match channel settlements against synced orders." />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-6">
        <Card className="p-0">
          <div className="px-4 py-3 border-b text-sm font-medium">
            Recent runs ({runs.length})
          </div>
          <DataTable
            rows={runs}
            rowKey={(r) => r.id}
            empty="No reconciliation runs yet."
            columns={[
              { key: 'channel', header: 'Channel', cell: (r) => r.channel.name },
              {
                key: 'period',
                header: 'Period',
                cell: (r) => (
                  <span className="tabular text-xs">
                    {new Date(r.periodStart).toISOString().slice(0, 10)} → {new Date(r.periodEnd).toISOString().slice(0, 10)}
                  </span>
                ),
              },
              { key: 'matched', header: 'Matched', align: 'right', cell: (r) => <span className="tabular">{r.matchedCount}</span> },
              { key: 'unmatched', header: 'Unmatched', align: 'right', cell: (r) => <span className="tabular">{r.unmatchedCount}</span> },
              { key: 'settled', header: 'Settled', align: 'right', cell: (r) => <span className="tabular font-medium">{r.totalSettled}</span> },
              { key: 'status', header: 'Status', cell: (r) => <Pill tone={STATUS_TONE[r.status] ?? 'grey'}>{r.status.toLowerCase()}</Pill> },
            ]}
          />
        </Card>

        <ReconcileForm branchId={branchId ?? ''} channels={channels.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </div>
  );
}
