import { PageHeader } from '@/components/shared/page-header';
import { DebitNoteForm } from '../_components/debit-note-form';
import { backendFetch } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Purchase Return' };

interface PurchaseLookups {
  branches: { id: string; name: string; code: string; currency: string }[];
  products: { id: string; sku: string; name: string; unit: string; costPrice: string }[];
  warehouses: { id: string; code: string; name: string; branchId: string }[];
}

interface SupplierOption {
  id: string;
  code: string;
  name: string;
  branchId: string;
  currency: string;
}

export default async function NewDebitNotePage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string; invoiceId?: string; grnId?: string }>;
}) {
  const sp = await searchParams;
  const [{ branches, warehouses, products }, suppliers] = await Promise.all([
    backendFetch<PurchaseLookups>('/api/mobile/purchase/lookups'),
    backendFetch<SupplierOption[]>('/api/mobile/suppliers?status=ACTIVE'),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Create Purchase Return"
        description="Issue a debit note against a supplier for returned goods"
      />
      <DebitNoteForm
        branches={branches}
        suppliers={suppliers}
        warehouses={warehouses}
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          costPrice: p.costPrice,
        }))}
        prefill={{
          supplierId: sp.supplierId ?? '',
          invoiceId: sp.invoiceId ?? '',
          grnId: sp.grnId ?? '',
        }}
      />
    </div>
  );
}
