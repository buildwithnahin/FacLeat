import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { contractsService } from '@/server/services/contracts.service';
import { PageHeader } from '@/components/shared/page-header';
import { ContractForm } from '../../../contracts/contract-form';

export const metadata = { title: 'Edit Offer Contract' };

export default async function EditOfferContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  await authorize(session, 'hr:write');

  let contract;
  try {
    contract = await contractsService.getById(session, id);
  } catch {
    notFound();
  }

  const [branches, shifts, candidate] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.shift.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    contract.candidateId
      ? prisma.hrWorkflowRecord.findUnique({
          where: { id: contract.candidateId },
          select: { metadata: true },
        })
      : Promise.resolve(null),
  ]);

  const candidateMeta = (candidate?.metadata as Record<string, unknown> | null) || null;
  const recruitmentRequestId =
    candidateMeta && typeof candidateMeta.recruitmentRequestId === 'string'
      ? candidateMeta.recruitmentRequestId
      : null;
  const recruitmentRequest = recruitmentRequestId
    ? await prisma.hrWorkflowRecord.findUnique({
        where: { id: recruitmentRequestId },
        select: { subject: true },
      })
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
    startDate: contract.startDate.toISOString().slice(0, 10),
    endDate: contract.endDate ? contract.endDate.toISOString().slice(0, 10) : null,
    basicSalary: contract.basicSalary.toString(),
    allowances: contract.allowances.toString(),
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
