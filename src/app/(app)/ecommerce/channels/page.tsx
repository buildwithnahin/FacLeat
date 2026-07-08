import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { Badge } from '@/components/ui/badge';
import { getSession } from '@/server/auth/session';
import { ecommerceService } from '@/server/services/ecommerce.service';

export const metadata = { title: 'E-commerce Channels' };

const TYPE_TONE: Record<string, PillTone> = {
  SHOPIFY: 'green',
  WOOCOMMERCE: 'blue',
  FACEBOOK: 'blue',
  DARAZ: 'amber',
  MANUAL: 'grey',
  OTHER: 'grey',
};

export default async function EcommerceChannelsPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId ?? undefined;
  const channels = await ecommerceService.listChannels(session, branchId);

  return (
    <div className="space-y-6">
      <PageHeader title="Channels" description="Storefronts synced into this branch." />

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          {channels.length} channel{channels.length === 1 ? '' : 's'}
        </div>
        <DataTable
          rows={channels}
          rowKey={(r) => r.id}
          empty="No channels synced yet — they're created automatically the first time an order is synced."
          columns={[
            { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'code', header: 'Code', cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { key: 'type', header: 'Type', cell: (r) => <Pill tone={TYPE_TONE[r.type] ?? 'grey'}>{r.type}</Pill> },
            { key: 'url', header: 'Store URL', cell: (r) => r.storeUrl ?? '—' },
            {
              key: 'active',
              header: 'Status',
              cell: (r) => <Badge variant={r.isActive ? 'success' : 'outline'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>,
            },
            {
              key: 'lastSync',
              header: 'Last sync',
              cell: (r) => (r.lastSyncAt ? <span className="tabular">{r.lastSyncAt.toISOString().slice(0, 16).replace('T', ' ')}</span> : '—'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
