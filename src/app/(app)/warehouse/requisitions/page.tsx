import Link from 'next/link';
import { Eye, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { Pill } from '@/components/shared/pill';
import { getSession } from '@/server/auth/session';
import { stockRequisitionService } from '@/server/services/stock-requisition.service';

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

export default async function StockRequisitionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  const branchId = session?.activeBranchId ?? undefined;
  const params = await searchParams;
  const status = params.status && params.status !== 'ALL' ? params.status : undefined;
  const rows = await stockRequisitionService.listRequisitions(session, {
    destinationBranchId: branchId,
    status: status as
      | 'DRAFT'
      | 'SUBMITTED'
      | 'APPROVED'
      | 'REJECTED'
      | 'WAREHOUSE_ASSIGNED'
      | 'PICKING'
      | 'PACKED'
      | 'DISPATCHED'
      | 'IN_TRANSIT'
      | 'RECEIVED'
      | 'COMPLETED'
      | 'CANCELLED'
      | undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Showroom Requisitions"
        description="Track showroom requests through approval, warehouse assignment, in-transit movement, and receipt."
      >
        <Button variant="dark" asChild>
          <Link href="/warehouse/requisitions/new">
            <Plus className="h-4 w-4" />
            New requisition
          </Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="flex items-end gap-3">
          <select
            name="status"
            defaultValue={params.status ?? 'ALL'}
            className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
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
