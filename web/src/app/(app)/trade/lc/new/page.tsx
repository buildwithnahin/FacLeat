import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { IssueLCForm } from '@/components/trade/issue-lc-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Issue Letter of Credit' };

interface FormOrder {
  id: string;
  number: string;
  type: string;
  currency: string;
  totalValue: string;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  goodsDescription: string | null;
  latestShipDate: string | null;
  customer: { name: string } | null;
  supplier: { name: string } | null;
}

interface FormOptions {
  orders: FormOrder[];
  branches: { id: string; name: string }[];
}

export default async function IssueLCPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const { orderId } = await searchParams;
  const session = await getSession();
  const branchId =
    session?.activeBranchId ??
    session?.defaultBranchId ??
    session?.allowedBranchIds?.[0] ??
    undefined;
  const qs = new URLSearchParams(branchId ? { branchId } : {});

  const { orders, branches } = await backendFetch<FormOptions>(`/api/mobile/trade/lc/form-options?${qs.toString()}`);

  const serializedOrders = orders.map((o) => ({
    ...o,
    totalValue: Number(o.totalValue),
    latestShipDate: o.latestShipDate ? new Date(o.latestShipDate) : null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Issue Letter of Credit" description="Open an LC linked to a trade order (SWIFT MT 700)." />
      <IssueLCForm
        orders={serializedOrders}
        branches={branches}
        defaultBranchId={branchId ?? branches[0]?.id ?? ''}
        preselectedOrderId={orderId}
      />
    </div>
  );
}
