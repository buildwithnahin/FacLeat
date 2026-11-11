import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { SupplierForm } from '../../supplier-form';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

interface SupplierEditDetail {
  id: string;
  branchId: string;
  name: string;
  code: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
  paymentTerms: string;
  currency: string;
  openingBalance: string;
  status: string;
  notes: string | null;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
  currency: string;
}

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let supplier: SupplierEditDetail;
  try {
    supplier = await backendFetch<SupplierEditDetail>(`/api/mobile/suppliers/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const { branches } = await backendFetch<{ branches: BranchOption[] }>('/api/mobile/suppliers/lookups');

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={`Edit ${supplier.name}`} description={supplier.code} />
      <SupplierForm
        mode="edit"
        branches={branches}
        initial={{
          id: supplier.id,
          branchId: supplier.branchId,
          name: supplier.name,
          contactPerson: supplier.contactPerson,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          city: supplier.city,
          country: supplier.country,
          taxId: supplier.taxId,
          paymentTerms: supplier.paymentTerms,
          currency: supplier.currency,
          openingBalance: supplier.openingBalance,
          status: supplier.status,
          notes: supplier.notes,
        }}
      />
    </div>
  );
}
