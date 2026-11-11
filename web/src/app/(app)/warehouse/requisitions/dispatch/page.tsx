import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { Pill } from '@/components/shared/pill';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'blue' | 'orange' | 'green' | 'red' | 'grey' | 'amber'> = {
  WAREHOUSE_ASSIGNED: 'blue',
  PICKING: 'orange',
  PACKED: 'orange',
  DISPATCHED: 'blue',
  IN_TRANSIT: 'blue',
  RECEIVED: 'green',
  COMPLETED: 'grey',
};

export const metadata = { title: 'Dispatch Queue' };

interface RequisitionRow {
  id: string;
  number: string;
  status: string;
  requiredDate: string;
  showroomWarehouse: { name: string; code: string };
  sourceWarehouse: { name: string; code: string } | null;
}

export default async function StockDispatchQueuePage() {
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];
  const qs = new URLSearchParams();
  if (branchId) qs.set('sourceBranchId', branchId);
  const rows = await backendFetch<RequisitionRow[]>(`/api/mobile/warehouse/requisitions?${qs.toString()}`);

  const filtered = rows.filter((row) =>
    ['WAREHOUSE_ASSIGNED', 'PICKING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED'].includes(
      row.status,
    ),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Dispatch Queue"
        description="Showroom requisitions assigned to this branch and moving through dispatch."
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Requisition</th>
                <th className="px-4 py-3">Showroom</th>
                <th className="px-4 py-3">Source warehouse</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Required date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No dispatch work queued for this branch.
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/warehouse/requisitions/${row.id}`} className="text-blue-600 hover:underline">
                      {row.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.showroomWarehouse.name}</td>
                  <td className="px-4 py-3">{row.sourceWarehouse?.name ?? 'Pending'}</td>
                  <td className="px-4 py-3">
                    <Pill tone={STATUS_TONE[row.status] ?? 'neutral'}>
                      {row.status.replaceAll('_', ' ').toLowerCase()}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">{new Date(row.requiredDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
