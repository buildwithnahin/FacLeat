import { PageHeader } from '@/components/shared/page-header';
import { CustomerForm } from '../customer-form';
import { backendFetch } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New customer' };

interface FormOptions {
  branches: { id: string; name: string; code: string }[];
  categories: { id: string; name: string }[];
}

export default async function NewCustomerPage() {
  const { branches, categories } = await backendFetch<FormOptions>('/api/mobile/crm/form-options');
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Add New Customer"
        description="Create a customer profile for sales and receivables"
      />
      <CustomerForm mode="create" branches={branches} categories={categories} />
    </div>
  );
}
