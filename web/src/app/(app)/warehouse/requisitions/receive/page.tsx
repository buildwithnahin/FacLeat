import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { Pill } from '@/components/shared/pill';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'blue' | 'orange' | 'green' | 'red' | 'grey' | 'amber'> = {
  DISPATCHED: 'blue',
  IN_TRANSIT: 'blue',
  RECEIVED: 'green',
};

export const metadata = { title: 'Showroom Receipts' };

interface ReceiptTransferRow {
  id: string;
  number: string;
  status: string;
  requisition: { id: string; number: string };
  fromWarehouse: { name: string };
  toWarehouse: { name: string };
}

export default async function StockReceiptQueuePage() {
  const session = await getSession();
  const branchId = session?.activeBranchId ?? session?.defaultBranchId;

  if (!branchId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Showroom receipts" />
        <Card className="p-6 text-sm text-muted-foreground">
          Select an active branch to view incoming showroom transfers.
        </Card>
      </div>
    );
  }

  const rows = await backendFetch<ReceiptTransferRow[]>(
    `/api/mobile/warehouse/requisitions/receipt-transfers?branchId=${branchId}`,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Showroom Receive Queue"
        description="Confirm dispatched transfers when they reach the showroom."
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Transfer</th>
                <th className="px-4 py-3">Requisition</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No incoming showroom transfers.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/warehouse/requisitions/${row.requisition.id}`} className="text-blue-600 hover:underline">
                      {row.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.requisition.number}</td>
                  <td className="px-4 py-3">{row.fromWarehouse.name}</td>
                  <td className="px-4 py-3">{row.toWarehouse.name}</td>
                  <td className="px-4 py-3">
                    <Pill tone={STATUS_TONE[row.status] ?? 'neutral'}>
                      {row.status.replaceAll('_', ' ').toLowerCase()}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
