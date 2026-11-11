import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { CustomerForm } from '../../customer-form';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

interface CustomerRecord {
  id: string;
  branchId: string;
  name: string;
  type: string;
  categoryId: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
  creditLimit: string;
  creditDays: number;
  currency: string;
  openingBalance: string;
  status: string;
  notes: string | null;
  code: string;
}

interface FormOptions {
  branches: { id: string; name: string; code: string }[];
  categories: { id: string; name: string }[];
}

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let customer: CustomerRecord;
  try {
    const data = await backendFetch<{ customer: CustomerRecord }>(`/api/mobile/crm/${id}`);
    customer = data.customer;
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const { branches, categories } = await backendFetch<FormOptions>('/api/mobile/crm/form-options');

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={`Edit ${customer.name}`} description={customer.code} />
      <CustomerForm
        mode="edit"
        branches={branches}
        categories={categories}
        initial={{
          id: customer.id,
          branchId: customer.branchId,
          name: customer.name,
          type: customer.type,
          categoryId: customer.categoryId,
          contactPerson: customer.contactPerson,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          city: customer.city,
          country: customer.country,
          taxId: customer.taxId,
          creditLimit: customer.creditLimit,
          creditDays: customer.creditDays,
          currency: customer.currency,
          openingBalance: customer.openingBalance,
          status: customer.status,
          notes: customer.notes,
        }}
      />
    </div>
  );
}
