import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import type { CurrencyCode } from '@/lib/money';
import { QuoteBuilder } from './builder';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Quote' };

interface Branch {
  id: string;
  name: string;
  code: string;
  companyId: string;
  currency: CurrencyCode;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  type: string;
  creditLimit: string;
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

export default async function NewQuotePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const branchId = session.activeBranchId ?? session.defaultBranchId ?? session.allowedBranchIds?.[0];
  if (!branchId) {
    return (
      <div className="space-y-4">
        <PageHeader title="New quote" description="Select an active branch first." />
        <Card className="p-6 text-sm">Pick a branch from the switcher to continue.</Card>
      </div>
    );
  }

  const branches = await backendFetch<Branch[]>('/api/mobile/branches');
  const branch = branches.find((b) => b.id === branchId);
  if (!branch) redirect('/corporate-sales');

  const [customers, products] = await Promise.all([
    backendFetch<Customer[]>(`/api/mobile/corporate-sales/customers?branchId=${encodeURIComponent(branchId)}`),
    backendFetch<Product[]>(`/api/mobile/corporate-sales/products/search?branchId=${encodeURIComponent(branchId)}`),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="New quote" description={`${branch.name} · ${branch.currency}`} />
      <QuoteBuilder branch={branch} customers={customers} initialProducts={products} />
    </div>
  );
}
