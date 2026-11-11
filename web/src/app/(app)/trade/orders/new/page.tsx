import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { NewTradeOrderForm } from '@/components/trade/new-trade-order-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Trade Order' };

interface FormOptions {
  branches: { id: string; name: string; code: string }[];
  customers: { id: string; name: string; code: string }[];
  suppliers: { id: string; name: string; code: string }[];
}

export default async function NewTradeOrderPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId ?? null;

  const { branches, customers, suppliers } = await backendFetch<FormOptions>(
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
      />
    </div>
  );
}
