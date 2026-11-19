import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { DispatchQueueClient, type DispatchQueueRow } from './dispatch-queue-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Dispatch Queue' };

export default async function StockDispatchQueuePage() {
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];
  const isAdmin = session?.roles.some((r) => r.toLowerCase().includes('admin'));

  const qs = new URLSearchParams();
  if (branchId && !isAdmin) qs.set('sourceBranchId', branchId);
  else qs.set('allBranches', 'true');

  const rows = await backendFetch<DispatchQueueRow[]>(`/api/mobile/warehouse/requisitions?${qs.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Dispatch Queue"
        description="Pack, gate pass, and dispatch stock requisitions moving to showrooms."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/warehouse/requisitions">All Requisitions</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/warehouse/requisitions/receive">Showroom Receive</Link>
          </Button>
        </div>
      </PageHeader>

      <DispatchQueueClient rows={rows} />
    </div>
  );
}
