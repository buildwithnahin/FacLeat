import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { CompanyForm } from '../company-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit company' };

interface CompanyDetail {
  id: string;
  code: string;
  name: string;
  currency: 'BDT' | 'INR' | 'USD' | 'EUR';
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let company: CompanyDetail;
  try {
    company = await backendFetch<CompanyDetail>(`/api/mobile/companies/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div>
      <PageHeader title={company.name} description={`${company.code} · ${company.currency}`} />
      <CompanyForm
        mode="edit"
        initial={{
          id: company.id,
          code: company.code,
          name: company.name,
          currency: company.currency,
          address: company.address,
          phone: company.phone,
          email: company.email,
          isActive: company.isActive,
        }}
      />
    </div>
  );
}
