import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import type { CurrencyCode } from '@/lib/money';
import { OrderBuilder } from './builder';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Order' };

interface Branch {
  id: string;
  name: string;
  code: string;
  companyId: string;
  currency: CurrencyCode;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: CurrencyCode;
}

interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  sellPrice: string;
  taxRate: string;
  imageUrl: string | null;
}

export default async function NewOrderPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const branchId = session.activeBranchId ?? session.defaultBranchId ?? session.allowedBranchIds?.[0];
  if (!branchId) {
    return (
      <div className="space-y-4">
        <PageHeader title="New order" description="Select an active branch first." />
        <Card className="p-6 text-sm">Pick a branch from the switcher to continue.</Card>
      </div>
    );
  }

  const [branches, warehouses, customers, products] = await Promise.all([
    backendFetch<Branch[]>('/api/mobile/branches'),
    backendFetch<Warehouse[]>(`/api/mobile/corporate-sales/warehouses?branchId=${encodeURIComponent(branchId)}`),
    backendFetch<Customer[]>(`/api/mobile/corporate-sales/customers?branchId=${encodeURIComponent(branchId)}`),
    backendFetch<Product[]>(`/api/mobile/corporate-sales/products/search?branchId=${encodeURIComponent(branchId)}`),
  ]);
  const branch = branches.find((b) => b.id === branchId);
  if (!branch) redirect('/corporate-sales');

  return (
    <div className="space-y-6">
      <PageHeader title="New order" description={`${branch.name} · ${branch.currency}`} />
      <OrderBuilder
        branch={branch}
        warehouses={warehouses}
        customers={customers}
        initialProducts={products}
      />
    </div>
  );
}
