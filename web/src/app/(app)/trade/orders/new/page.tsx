import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { NewTradeOrderForm, type TradeProductOption } from '@/components/trade/new-trade-order-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Trade Order' };

interface FormOptions {
  branches: { id: string; name: string; code: string }[];
  customers: { id: string; name: string; code: string }[];
  suppliers: { id: string; name: string; code: string }[];
  products?: TradeProductOption[];
}

export default async function NewTradeOrderPage() {
  const session = await getSession();
  const branchId =
    session?.activeBranchId ??
    session?.defaultBranchId ??
    session?.allowedBranchIds?.[0] ??
    null;

  const { branches, customers, suppliers, products } = await backendFetch<FormOptions>(
    '/api/mobile/trade/orders/form-options',
  );

  return (
    <div className="space-y-6">
      <PageHeader title="New Trade Order" description="Create an export or import order." />
      <NewTradeOrderForm
        defaultBranchId={branchId ?? branches[0]?.id ?? ''}
        branches={branches}
        customers={customers}
        suppliers={suppliers}
        products={products ?? []}
      />
    </div>
  );
}
