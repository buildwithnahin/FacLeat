import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { ShiftForm } from '../shift-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New Shift' };

interface FormOptions {
  branches: { id: string; code: string; name: string }[];
}

export default async function NewShiftPage() {
  const { branches } = await backendFetch<FormOptions>('/api/mobile/hr/shifts/form-options');

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Shift"
        description="Create a practical shift rule set for attendance, overtime, and payroll processing."
      />
      <ShiftForm mode="create" branches={branches} />
    </div>
  );
}
