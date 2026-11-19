import Link from 'next/link';
import { Eye, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { Pill } from '@/components/shared/pill';
import { Input } from '@/components/ui/input';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Stock Requisitions' };

const STATUS_TONE: Record<string, 'blue' | 'orange' | 'green' | 'red' | 'grey' | 'amber'> = {
  DRAFT: 'blue',
  SUBMITTED: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  WAREHOUSE_ASSIGNED: 'blue',
  PICKING: 'orange',
  PACKED: 'orange',
  DISPATCHED: 'blue',
  IN_TRANSIT: 'blue',
  RECEIVED: 'green',
  COMPLETED: 'grey',
  CANCELLED: 'grey',
};

interface RequisitionRow {
  id: string;
  number: string;
  status: string;
  requiredDate: string;
  showroomWarehouse: { name: string; code: string };
  sourceWarehouse: { name: string; code: string } | null;
  items: { id: string }[];
}

export default async function StockRequisitionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; direction?: string }>;
}) {
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];
  const params = await searchParams;
  const status = params.status && params.status !== 'ALL' ? params.status : undefined;
  const direction = params.direction && params.direction !== 'ALL' ? params.direction : undefined;
  const query = (params.q ?? '').trim().toLowerCase();

  const qs = new URLSearchParams();
  if (branchId) qs.set('branchId', branchId);
  if (status) qs.set('status', status);
  if (direction) qs.set('direction', direction);

  const rawRows = await backendFetch<RequisitionRow[]>(`/api/mobile/warehouse/requisitions?${qs.toString()}`);

  const rows = query
    ? rawRows.filter(
        (row) =>
          row.number.toLowerCase().includes(query) ||
          row.showroomWarehouse.name.toLowerCase().includes(query) ||
          row.showroomWarehouse.code.toLowerCase().includes(query) ||
          (row.sourceWarehouse && row.sourceWarehouse.name.toLowerCase().includes(query)),
      )
    : rawRows;

  const hasFilter = Boolean(query || (params.status && params.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Showroom Requisitions"
        description="Track showroom requests through approval, warehouse assignment, in-transit movement, and receipt."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/warehouse/requisitions/dispatch">Dispatch Queue</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/warehouse/requisitions/receive">Receive Queue</Link>
          </Button>
          <Button variant="dark" asChild>
            <Link href="/warehouse/requisitions/new">
              <Plus className="h-4 w-4" />
              New requisition
            </Link>
          </Button>
        </div>
      </PageHeader>

      <Card className="p-4">
        <form method="GET" className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search by requisition # or showroom…"
              className="pl-9 h-9"
            />
          </div>
          <select
            name="direction"
            defaultValue={params.direction ?? 'ALL'}
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">All Requisitions</option>
            <option value="INCOMING">My Showroom Requests</option>
            <option value="OUTGOING">Warehouse Fulfillments</option>
          </select>
          <select
            name="status"
            defaultValue={params.status ?? 'ALL'}
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">All statuses</option>
            {Object.keys(STATUS_TONE).map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {hasFilter && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/warehouse/requisitions" className="gap-1">
                <X className="h-3.5 w-3.5" />
                Clear
              </Link>
            </Button>
          )}
        </form>
      </Card>

      <Card className="p-0">
        <div className="border-b px-4 py-3 text-sm font-medium">
          Requisitions ({rows.length})
        </div>
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          empty="No showroom requisitions yet."
          columns={[
            {
              key: 'number',
              header: 'Requisition',
              cell: (row) => (
                <Link href={`/warehouse/requisitions/${row.id}`} className="text-blue-600 hover:underline">
                  {row.number}
                </Link>
              ),
            },
            {
              key: 'showroom',
              header: 'Showroom',
              cell: (row) => `${row.showroomWarehouse.name} (${row.showroomWarehouse.code})`,
            },
            {
              key: 'source',
              header: 'Source warehouse',
              cell: (row) =>
                row.sourceWarehouse
                  ? `${row.sourceWarehouse.name} (${row.sourceWarehouse.code})`
                  : 'Pending assignment',
            },
            {
              key: 'items',
              header: 'Items',
              cell: (row) => `${row.items.length} item${row.items.length === 1 ? '' : 's'}`,
            },
            {
              key: 'requiredDate',
              header: 'Required date',
              cell: (row) => new Date(row.requiredDate).toLocaleDateString(),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (row) => (
                <Pill tone={STATUS_TONE[row.status] ?? 'neutral'}>
                  {row.status.replaceAll('_', ' ').toLowerCase()}
                </Pill>
              ),
            },
            {
              key: 'actions',
              header: 'Action',
              cell: (row) => (
                <Link
                  href={`/warehouse/requisitions/${row.id}`}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
