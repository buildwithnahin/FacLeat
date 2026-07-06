import { getSession } from '@/server/auth/session';
import { companyService } from '@/server/services/company.service';
import { PageHeader } from '@/components/shared/page-header';
import { CompanyForm } from '../company-form';

export const metadata = { title: 'Edit company' };

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const company = await companyService.getById(session, id);

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
