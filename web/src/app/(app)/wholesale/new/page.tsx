import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import type { CurrencyCode } from '@/lib/money';
import { InvoiceBuilder } from './builder';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Wholesale Invoice' };

interface Branch {
  id: string;
  name: string;
  code: string;
  currency: CurrencyCode;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  type: string;
  creditLimit: string;
  creditDays: number;
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

export default async function NewWholesaleInvoicePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const branchId = session.activeBranchId ?? session.defaultBranchId ?? session.allowedBranchIds?.[0];
  if (!branchId) {
    return (
      <div className="space-y-4">
        <PageHeader title="New wholesale invoice" description="Pick an active branch first." />
        <Card className="p-6 text-sm">Select an active branch from the switcher to continue.</Card>
      </div>
    );
  }

  const [branches, warehouses, customers, initialProducts] = await Promise.all([
    backendFetch<Branch[]>('/api/mobile/branches'),
    backendFetch<Warehouse[]>(`/api/mobile/wholesale/warehouses?branchId=${encodeURIComponent(branchId)}`),
    backendFetch<Customer[]>(`/api/mobile/wholesale/customers?branchId=${encodeURIComponent(branchId)}`),
    backendFetch<Product[]>(`/api/mobile/wholesale/products/search?branchId=${encodeURIComponent(branchId)}`),
  ]);
  const branch = branches.find((b) => b.id === branchId);

  if (!branch) {
    return (
      <div className="space-y-4">
        <PageHeader title="New wholesale invoice" />
        <Card className="p-6 text-sm text-red-600">Active branch not found.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New wholesale invoice"
        description={`${branch.name} · ${branch.currency}`}
      />
      <InvoiceBuilder
        branch={branch}
        warehouses={warehouses}
        customers={customers}
        initialProducts={initialProducts}
      />
    </div>
  );
}
