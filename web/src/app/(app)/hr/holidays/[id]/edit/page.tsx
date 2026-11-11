import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { HolidayForm } from '../../holiday-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit Holiday' };

interface HolidayDetail {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  type: string;
  branchId: string | null;
  isPaid: boolean;
  status: string;
  description: string | null;
}

interface FormOptions {
  branches: { id: string; code: string; name: string }[];
}

export default async function EditHolidayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let holiday: HolidayDetail;
  try {
    holiday = await backendFetch<HolidayDetail>(`/api/mobile/hr/holidays/${id}`);
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) notFound();
    throw error;
  }

  const { branches } = await backendFetch<FormOptions>('/api/mobile/hr/holidays/form-options');

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${holiday.name}`} description="Update holiday details used by attendance, leave, and payroll rules." />
      <HolidayForm
        mode="edit"
        branches={branches}
        initial={{
          id: holiday.id,
          name: holiday.name,
          code: holiday.code,
          startDate: holiday.startDate.slice(0, 10),
          endDate: holiday.endDate.slice(0, 10),
          type: holiday.type,
          branchId: holiday.branchId,
          isPaid: holiday.isPaid,
          status: holiday.status,
          description: holiday.description,
        }}
      />
    </div>
  );
}
