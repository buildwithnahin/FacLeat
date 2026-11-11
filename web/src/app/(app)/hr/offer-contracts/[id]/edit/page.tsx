import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { ContractForm } from '../../../contracts/contract-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit Offer Contract' };

interface BranchRow {
  id: string;
  code: string;
  name: string;
}

interface ShiftRow {
  id: string;
  code: string;
  name: string;
}

interface ContractDetail {
  id: string;
  contractNo: string;
  employeeId: string | null;
  candidateId: string | null;
  offerId: string | null;
  candidateName: string | null;
  branchId: string | null;
  department: string | null;
  designation: string | null;
  contractType: string;
  startDate: string;
  endDate: string | null;
  basicSalary: string;
  allowances: string;
  shiftId: string | null;
  weeklyOff: string;
  status: string;
  attachmentUrl: string | null;
  notes: string | null;
}

interface WorkflowRecordDetail {
  id: string;
  subject: string | null;
  metadata: Record<string, unknown> | null;
}

export default async function EditOfferContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getSession();

  let contract: ContractDetail;
  try {
    contract = await backendFetch<ContractDetail>(`/api/mobile/hr/contracts/${id}`);
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) notFound();
    throw err;
  }

  const [branches, shifts, candidate] = await Promise.all([
    backendFetch<BranchRow[]>('/api/mobile/branches?activeOnly=true'),
    backendFetch<ShiftRow[]>('/api/mobile/hr/shifts'),
    contract.candidateId
      ? backendFetch<WorkflowRecordDetail>(`/api/mobile/hr/workflow-records/${contract.candidateId}`).catch(() => null)
      : Promise.resolve(null),
  ]);

  const candidateMeta = candidate?.metadata ?? null;
  const recruitmentRequestId =
    candidateMeta && typeof candidateMeta.recruitmentRequestId === 'string' ? candidateMeta.recruitmentRequestId : null;
  const recruitmentRequest = recruitmentRequestId
    ? await backendFetch<WorkflowRecordDetail>(`/api/mobile/hr/workflow-records/${recruitmentRequestId}`).catch(() => null)
    : null;
  const resolvedDepartment =
    (contract.department && contract.department !== 'Production' ? contract.department : null) ||
    (candidateMeta && typeof candidateMeta.department === 'string' ? candidateMeta.department : null) ||
    recruitmentRequest?.subject ||
    contract.department;

  const initialData = {
    id: contract.id,
    contractNo: contract.contractNo,
    employeeId: contract.employeeId,
    candidateId: contract.candidateId,
    offerId: contract.offerId,
    candidateName: contract.candidateName,
    branchId: contract.branchId,
    department: resolvedDepartment,
    designation: contract.designation,
    contractType: contract.contractType,
    startDate: new Date(contract.startDate).toISOString().slice(0, 10),
    endDate: contract.endDate ? new Date(contract.endDate).toISOString().slice(0, 10) : null,
    basicSalary: contract.basicSalary,
    allowances: contract.allowances,
    shiftId: contract.shiftId,
    weeklyOff: contract.weeklyOff,
    status: contract.status,
    attachmentUrl: contract.attachmentUrl,
    notes: contract.notes,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Offer Contract"
        description={`Manage the pre-employment contract for ${contract.candidateName || 'this candidate'} before joining is completed.`}
      />
      <ContractForm
        mode="edit"
        scope="offer"
        branches={branches}
        shifts={shifts}
        employees={[]}
        initial={initialData}
      />
    </div>
  );
}
