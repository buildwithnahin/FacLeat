import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { getSession } from '@/server/auth/session';
import { ecommerceService } from '@/server/services/ecommerce.service';
import { ReconcileForm } from './reconcile-form';

export const metadata = { title: 'E-commerce Reconciliation' };

const STATUS_TONE: Record<string, PillTone> = {
  DRAFT: 'grey',
  COMPLETED: 'green',
};

export default async function EcommerceReconcilePage() {
  const session = await getSession();
  const branchId = session?.activeBranchId ?? undefined;
  const [channels, runs] = await Promise.all([
    ecommerceService.listChannels(session, branchId),
    ecommerceService.listReconciliationRuns(session, branchId),
  ]);

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
                    {r.periodStart.toISOString().slice(0, 10)} → {r.periodEnd.toISOString().slice(0, 10)}
                  </span>
                ),
              },
              { key: 'matched', header: 'Matched', align: 'right', cell: (r) => <span className="tabular">{r.matchedCount}</span> },
              { key: 'unmatched', header: 'Unmatched', align: 'right', cell: (r) => <span className="tabular">{r.unmatchedCount}</span> },
              { key: 'settled', header: 'Settled', align: 'right', cell: (r) => <span className="tabular font-medium">{r.totalSettled.toString()}</span> },
              { key: 'status', header: 'Status', cell: (r) => <Pill tone={STATUS_TONE[r.status] ?? 'grey'}>{r.status.toLowerCase()}</Pill> },
            ]}
          />
        </Card>

        <ReconcileForm branchId={branchId ?? ''} channels={channels.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </div>
  );
}
