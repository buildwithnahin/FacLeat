import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { ReceiveQueueClient, type ReceiptTransferRow } from './receive-queue-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Showroom Receipts' };

export default async function StockReceiptQueuePage() {
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];
  const isAdmin = session?.roles.some((r) => r.toLowerCase().includes('admin'));

  const qs = new URLSearchParams();
  if (branchId && !isAdmin) qs.set('branchId', branchId);
  else qs.set('allBranches', 'true');

  const rows = await backendFetch<ReceiptTransferRow[]>(
    `/api/mobile/warehouse/requisitions/receipt-transfers?${qs.toString()}`,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Showroom Receive Queue"
        description="Inspect and confirm stock receipts directly into showroom inventory."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/warehouse/requisitions">Showroom Requisitions</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/warehouse/requisitions/dispatch">Dispatch Queue</Link>
          </Button>
        </div>
      </PageHeader>

      <ReceiveQueueClient transfers={rows} />
    </div>
  );
}
