import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { HolidayForm } from '../holiday-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Holiday' };

interface FormOptions {
  branches: { id: string; code: string; name: string }[];
}

export default async function NewHolidayPage() {
  const { branches } = await backendFetch<FormOptions>('/api/mobile/hr/holidays/form-options');

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Holiday"
        description="Create branch-wide or branch-specific holidays for attendance, leave, and payroll logic."
      />
      <HolidayForm mode="create" branches={branches} />
    </div>
  );
}
