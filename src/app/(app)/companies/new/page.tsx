import { PageHeader } from '@/components/shared/page-header';
import { CompanyForm } from '../company-form';

export const metadata = { title: 'New company' };

export default function NewCompanyPage() {
  return (
    <div>
      <PageHeader title="New company" description="Create a new operating entity." />
      <CompanyForm mode="create" />
    </div>
  );
}
