import 'server-only';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { storagePut, storageGet } from '@/server/storage';
import type { AppSession } from '@/server/auth/session';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';

/**
 * Ported from the pre-split `src/server/actions/hr-recruitment.ts` Server
 * Action (business logic used to live directly in the action there). Moved
 * into a service here per this app's rule that Route Handlers stay thin —
 * the recruitment pipeline (request -> candidate -> interview -> offer ->
 * joining) all rides on the generic `HrWorkflowRecord` table, discriminated
 * by `section`, exactly as it did before the backend/web split.
 */

const RECRUITMENT_APPROVAL_STEPS = [
  { status: 'HR Review', role: 'HR', nextStatus: 'Accounts Budget Check' },
  { status: 'Accounts Budget Check', role: 'Accounts', nextStatus: 'Management Approval' },
  { status: 'Management Approval', role: 'Management', nextStatus: 'Approved' },
] as const;

function currentRecruitmentStep(status: string) {
  return RECRUITMENT_APPROVAL_STEPS.find((step) => step.status === status);
}

function canApproveRecruitmentStep(roles: string[], status: string) {
  const step = currentRecruitmentStep(status);
  if (!step) return false;
  return roles.includes(step.role) || roles.includes('Admin') || roles.includes('Super Admin');
}

function employmentTypeFromContractType(contractType: string | null | undefined) {
  if (contractType === 'INTERNSHIP') return 'INTERN';
  if (contractType === 'PERMANENT' || contractType === 'PROBATION' || contractType === 'CONTRACT') {
    return contractType;
  }
  return 'CONTRACT';
}

const ALLOWED_CV_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024;

function extname(name: string) {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx).toLowerCase();
}

export const recruitmentService = {
  // ─── Recruitment Requests ────────────────────────────────────────────────
  async listRequests(session: AppSession | null) {
    await authorize(session, 'hr:read');
    return prisma.hrWorkflowRecord.findMany({
      where: { section: 'recruitment' },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createRequest(
    session: AppSession | null,
    input: {
      position: string;
      department: string;
      vacancies: number;
      reason: string;
      salaryRange: string;
      expectedJoining: string;
      priority?: string;
    },
  ) {
    const actor = await authorize(session, 'hr:write');

    const title = input.position.trim();
    const subject = input.department.trim();
    if (!title) throw new ValidationError('Position is required');
    if (!subject) throw new ValidationError('Department is required');
    if (!input.expectedJoining) throw new ValidationError('Expected joining date is required');

    const expectedJoining = new Date(input.expectedJoining);
    const department = await prisma.hrMasterData.findFirst({
      where: { type: 'departments', name: subject, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!department) throw new ValidationError('Please select an active department from HR master data');

    const count = await prisma.hrWorkflowRecord.count({
      where: { section: 'recruitment', createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) } },
    });
    const requestNo = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    return prisma.$transaction(async (tx) => {
      const row = await tx.hrWorkflowRecord.create({
        data: {
          branchId: actor.activeBranchId ?? null,
          section: 'recruitment',
          title,
          subject,
          status: 'HR Review',
          priority: input.priority ?? 'NORMAL',
          startDate: expectedJoining,
          amount: input.vacancies,
          owner: input.salaryRange,
          notes: input.reason,
          metadata: {
            requestNo,
            vacancies: input.vacancies,
            salaryRange: input.salaryRange,
            reason: input.reason,
            approvalFlow: RECRUITMENT_APPROVAL_STEPS.map((step) => ({ role: step.role, status: step.status })),
          },
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'create-recruitment-request',
          entityType: 'HrWorkflowRecord',
          entityId: row.id,
          after: { requestNo, title, subject, vacancies: input.vacancies },
        },
        tx,
      );

      return row;
    });
  },

  async decideRequest(session: AppSession | null, id: string, decision: 'Approved' | 'Rejected' | 'Cancelled') {
    if (!session) throw new UnauthorizedError();

    return prisma.$transaction(async (tx) => {
      const record = await tx.hrWorkflowRecord.findUnique({ where: { id } });
      if (!record || record.section !== 'recruitment') throw new NotFoundError('Recruitment request not found');

      const isHrWriter = session.permissions.includes('hr:write');
      const canApprove = canApproveRecruitmentStep(session.roles ?? [], record.status);
      if (!isHrWriter && !canApprove) {
        throw new ForbiddenError('This recruitment step must be approved by the assigned ERP role');
      }

      const actor = isHrWriter ? await authorize(session, 'hr:write') : session;
      const step = currentRecruitmentStep(record.status);
      const nextStatus = decision === 'Approved' && step ? step.nextStatus : decision;
      const metadata = (record.metadata as Record<string, any>) || {};
      const approvals = Array.isArray(metadata.approvals) ? metadata.approvals : [];

      const updated = await tx.hrWorkflowRecord.update({
        where: { id },
        data: {
          status: nextStatus,
          metadata: {
            ...metadata,
            approvals:
              decision === 'Approved'
                ? [
                    ...approvals,
                    {
                      role: step?.role ?? 'Admin',
                      fromStatus: record.status,
                      toStatus: nextStatus,
                      userId: actor.userId,
                      decidedAt: new Date().toISOString(),
                    },
                  ]
                : approvals,
          },
          updatedById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'decide-recruitment-request',
          entityType: 'HrWorkflowRecord',
          entityId: id,
          before: { status: record.status },
          after: { status: nextStatus, decision },
        },
        tx,
      );

      return updated;
    });
  },

  // ─── Candidates ───────────────────────────────────────────────────────────
  async listCandidates(session: AppSession | null, filters: { status?: string } = {}) {
    await authorize(session, 'hr:read');
    return prisma.hrWorkflowRecord.findMany({
      where: { section: 'candidates', status: filters.status || undefined },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createCandidate(
    session: AppSession | null,
    input: {
      name: string;
      recruitmentRequestId: string;
      phone: string;
      email: string;
      experience: string;
      education: string;
      expectedSalary: number;
      source: string;
    },
    cv: { name: string; buffer: Buffer } | null,
  ) {
    const actor = await authorize(session, 'hr:write');

    const name = input.name.trim();
    if (!name) throw new ValidationError('Candidate name is required');
    if (!input.recruitmentRequestId) throw new ValidationError('Recruitment request reference is required');

    const req = await prisma.hrWorkflowRecord.findUnique({ where: { id: input.recruitmentRequestId } });
    if (!req) throw new ValidationError('Recruitment request not found');
    const requestDepartment = req.subject || '';

    let uploadedCv: { storagePath: string; originalName: string } | null = null;
    if (cv) {
      const extension = extname(cv.name);
      if (!ALLOWED_CV_EXTENSIONS.has(extension)) {
        throw new ValidationError('CV must be a PDF, DOC, or DOCX file');
      }
      if (cv.buffer.byteLength > MAX_CV_SIZE_BYTES) {
        throw new ValidationError('CV file size must be 5MB or less');
      }
      const { storagePath } = await storagePut(cv.name, cv.buffer);
      uploadedCv = { storagePath, originalName: cv.name };
    }

    const count = await prisma.hrWorkflowRecord.count({ where: { section: 'candidates' } });
    const candidateId = `CAN-${String(count + 1).padStart(5, '0')}`;

    return prisma.$transaction(async (tx) => {
      const row = await tx.hrWorkflowRecord.create({
        data: {
          branchId: req.branchId ?? actor.activeBranchId ?? null,
          section: 'candidates',
          title: name,
          subject: req.title,
          status: 'Applied',
          priority: 'NORMAL',
          amount: input.expectedSalary,
          owner: input.source,
          notes: `${input.experience}\nEducation: ${input.education}`,
          metadata: {
            candidateId,
            recruitmentRequestId: input.recruitmentRequestId,
            department: requestDepartment,
            phone: input.phone,
            email: input.email,
            experience: input.experience,
            education: input.education,
            source: input.source,
            cvName: uploadedCv?.originalName || '',
            cvStoragePath: uploadedCv?.storagePath || '',
          },
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'create-candidate',
          entityType: 'HrWorkflowRecord',
          entityId: row.id,
          after: { candidateId, name, position: req.title },
        },
        tx,
      );

      return row;
    });
  },

  async decideCandidate(
    session: AppSession | null,
    id: string,
    status: 'Applied' | 'Shortlisted' | 'Passed' | 'Selected' | 'Rejected' | 'Joined' | 'Employee Created',
  ) {
    const actor = await authorize(session, 'hr:write');

    return prisma.$transaction(async (tx) => {
      const record = await tx.hrWorkflowRecord.findUnique({ where: { id } });
      if (!record || record.section !== 'candidates') throw new NotFoundError('Candidate not found');

      const updated = await tx.hrWorkflowRecord.update({
        where: { id },
        data: { status, updatedById: actor.userId },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'decide-candidate',
          entityType: 'HrWorkflowRecord',
          entityId: id,
          before: { status: record.status },
          after: { status },
        },
        tx,
      );

      return updated;
    });
  },

  async getCandidateCv(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const candidate = await prisma.hrWorkflowRecord.findUnique({ where: { id } });
    if (!candidate || candidate.section !== 'candidates') throw new NotFoundError('Candidate not found');
    const meta = (candidate.metadata as Record<string, any>) || {};
    const storagePath = meta.cvStoragePath as string | undefined;
    const cvName = (meta.cvName as string | undefined) || 'cv';
    if (!storagePath) throw new NotFoundError('CV not found');
    const buffer = await storageGet(storagePath);
    return { buffer, cvName };
  },

  // ─── Interviews ───────────────────────────────────────────────────────────
  async listInterviews(session: AppSession | null) {
    await authorize(session, 'hr:read');
    return prisma.hrWorkflowRecord.findMany({
      where: { section: 'interviews' },
      orderBy: { startDate: 'desc' },
    });
  },

  async scheduleInterview(
    session: AppSession | null,
    input: { candidateId: string; interviewDate: string; interviewType: string; panel: string },
  ) {
    const actor = await authorize(session, 'hr:write');

    if (!input.candidateId) throw new ValidationError('Candidate is required');
    if (!input.interviewDate) throw new ValidationError('Interview date is required');

    const candidate = await prisma.hrWorkflowRecord.findUnique({ where: { id: input.candidateId } });
    if (!candidate || candidate.section !== 'candidates') throw new ValidationError('Candidate record not found');

    const interviewDate = new Date(input.interviewDate);

    return prisma.$transaction(async (tx) => {
      const row = await tx.hrWorkflowRecord.create({
        data: {
          branchId: candidate.branchId ?? actor.activeBranchId ?? null,
          section: 'interviews',
          title: `Interview - ${candidate.title}`,
          subject: input.interviewType,
          status: 'Scheduled',
          startDate: interviewDate,
          owner: input.panel,
          metadata: {
            candidateId: input.candidateId,
            candidateName: candidate.title,
            panel: input.panel,
            interviewType: input.interviewType,
          },
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      await tx.hrWorkflowRecord.update({
        where: { id: input.candidateId },
        data: { status: 'Interview Scheduled' },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'schedule-interview',
          entityType: 'HrWorkflowRecord',
          entityId: row.id,
          after: { candidateName: candidate.title, interviewType: input.interviewType, interviewDate },
        },
        tx,
      );

      return row;
    });
  },

  async evaluateInterview(
    session: AppSession | null,
    input: {
      interviewId: string;
      communication: number;
      technicalSkill: number;
      remarks: string;
      recommendation: string;
    },
  ) {
    const actor = await authorize(session, 'hr:write');
    if (!input.interviewId) throw new ValidationError('Interview ID is required');

    return prisma.$transaction(async (tx) => {
      const interview = await tx.hrWorkflowRecord.findUnique({ where: { id: input.interviewId } });
      if (!interview || interview.section !== 'interviews') throw new NotFoundError('Interview not found');

      const meta = (interview.metadata as Record<string, any>) || {};
      const candidateId = meta.candidateId;

      const updated = await tx.hrWorkflowRecord.update({
        where: { id: input.interviewId },
        data: {
          status: 'Interview Completed',
          notes: input.remarks,
          amount: (input.communication + input.technicalSkill) / 2,
          metadata: {
            ...meta,
            recommendation: input.recommendation,
            scores: { communication: input.communication, technicalSkill: input.technicalSkill },
          },
          updatedById: actor.userId,
        },
      });

      if (candidateId) {
        await tx.hrWorkflowRecord.update({ where: { id: candidateId }, data: { status: input.recommendation } });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'evaluate-interview',
          entityType: 'HrWorkflowRecord',
          entityId: input.interviewId,
          after: { recommendation: input.recommendation, communication: input.communication, technicalSkill: input.technicalSkill },
        },
        tx,
      );

      return updated;
    });
  },

  // ─── Job Offers ───────────────────────────────────────────────────────────
  async listJobOffers(session: AppSession | null) {
    await authorize(session, 'hr:read');
    return prisma.hrWorkflowRecord.findMany({
      where: { section: 'job-offers' },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createJobOffer(
    session: AppSession | null,
    input: { candidateId: string; salary: number; joiningDate: string; expiryDate: string; notes: string },
  ) {
    const actor = await authorize(session, 'hr:write');

    if (!input.candidateId) throw new ValidationError('Candidate is required');
    if (!input.salary) throw new ValidationError('Salary is required');
    if (!input.joiningDate) throw new ValidationError('Joining date is required');
    if (!input.expiryDate) throw new ValidationError('Offer expiry date is required');

    const candidate = await prisma.hrWorkflowRecord.findUnique({ where: { id: input.candidateId } });
    if (!candidate || candidate.section !== 'candidates') throw new ValidationError('Candidate not found');

    const candidateMeta = (candidate.metadata as Record<string, any>) || {};
    let resolvedDepartment = typeof candidateMeta.department === 'string' ? candidateMeta.department.trim() : '';
    if (!resolvedDepartment && typeof candidateMeta.recruitmentRequestId === 'string' && candidateMeta.recruitmentRequestId) {
      const recruitmentRequest = await prisma.hrWorkflowRecord.findUnique({
        where: { id: candidateMeta.recruitmentRequestId },
        select: { subject: true },
      });
      resolvedDepartment = recruitmentRequest?.subject?.trim() || '';
    }

    const count = await prisma.hrWorkflowRecord.count({ where: { section: 'job-offers' } });
    const offerNo = `OFF-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    return prisma.$transaction(async (tx) => {
      const row = await tx.hrWorkflowRecord.create({
        data: {
          branchId: candidate.branchId ?? actor.activeBranchId ?? null,
          section: 'job-offers',
          title: offerNo,
          subject: candidate.subject,
          status: 'Job Offer Sent',
          startDate: new Date(input.joiningDate),
          endDate: new Date(input.expiryDate),
          amount: input.salary,
          notes: input.notes,
          metadata: {
            candidateId: input.candidateId,
            candidateName: candidate.title,
            recruitmentRequestId: candidateMeta.recruitmentRequestId,
            department: resolvedDepartment,
            phone: candidateMeta.phone,
            email: candidateMeta.email,
            offerNo,
          },
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      await tx.hrWorkflowRecord.update({
        where: { id: input.candidateId },
        data: { status: 'Job Offer Sent' },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'create-job-offer',
          entityType: 'HrWorkflowRecord',
          entityId: row.id,
          after: { offerNo, candidateName: candidate.title, salary: input.salary },
        },
        tx,
      );

      return row;
    });
  },

  async decideJobOffer(session: AppSession | null, id: string, status: 'Offer Accepted' | 'Rejected' | 'Job Offer Sent') {
    const actor = await authorize(session, 'hr:write');

    return prisma.$transaction(async (tx) => {
      const offer = await tx.hrWorkflowRecord.findUnique({ where: { id } });
      if (!offer || offer.section !== 'job-offers') throw new NotFoundError('Job offer not found');

      const meta = (offer.metadata as Record<string, any>) || {};
      const candidateId = meta.candidateId;

      const updated = await tx.hrWorkflowRecord.update({
        where: { id },
        data: { status, updatedById: actor.userId },
      });

      if (status === 'Offer Accepted') {
        const existingContract = await tx.contract.findFirst({ where: { offerId: id }, select: { id: true } });
        if (!existingContract) {
          const contractCount = await tx.contract.count();
          const startDate = offer.startDate ?? new Date();
          const fallbackEndDate = new Date(startDate);
          fallbackEndDate.setFullYear(fallbackEndDate.getFullYear() + 1);
          const endDate = offer.endDate && offer.endDate >= startDate ? offer.endDate : fallbackEndDate;

          await tx.contract.create({
            data: {
              contractNo: `CNT-${new Date().getFullYear()}-${String(contractCount + 1).padStart(4, '0')}`,
              employeeId: null,
              candidateId: candidateId || null,
              offerId: id,
              candidateName: (meta.candidateName as string | undefined) || offer.title,
              branchId: offer.branchId || actor.activeBranchId || null,
              department: (meta.department as string | undefined) || null,
              designation: offer.subject || null,
              contractType: 'CONTRACT',
              startDate,
              endDate,
              basicSalary: offer.amount ?? 0,
              allowances: 0,
              weeklyOff: 'Friday',
              status: 'DRAFT',
              notes: `Auto-created from accepted job offer ${meta.offerNo || offer.title}.`,
              createdById: actor.userId,
              updatedById: actor.userId,
            },
          });
        }
      }

      if (candidateId) {
        await tx.hrWorkflowRecord.update({
          where: { id: candidateId },
          data: { status: status === 'Offer Accepted' ? 'Offer Accepted' : 'Passed' },
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'decide-job-offer',
          entityType: 'HrWorkflowRecord',
          entityId: id,
          before: { status: offer.status },
          after: { status },
        },
        tx,
      );

      return updated;
    });
  },

  // ─── Joining ──────────────────────────────────────────────────────────────
  async listJoining(session: AppSession | null) {
    await authorize(session, 'hr:read');
    return prisma.hrWorkflowRecord.findMany({
      where: { section: 'joining' },
      orderBy: { createdAt: 'desc' },
    });
  },

  async listAcceptedOffersReadyForJoining(session: AppSession | null) {
    await authorize(session, 'hr:read');
    const [offers, readyContracts] = await Promise.all([
      prisma.hrWorkflowRecord.findMany({
        where: { section: 'job-offers', status: 'Offer Accepted' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contract.findMany({
        where: { offerId: { not: null }, status: { in: ['SIGNED', 'WAITING_FOR_JOINING'] } },
        select: { offerId: true, contractType: true, department: true, designation: true },
      }),
    ]);

    const readyContractsByOfferId = new Map(
      readyContracts
        .filter((contract): contract is typeof contract & { offerId: string } => Boolean(contract.offerId))
        .map((contract) => [contract.offerId, contract]),
    );

    return offers
      .filter((offer) => readyContractsByOfferId.has(offer.id))
      .map((offer) => {
        const linkedContract = readyContractsByOfferId.get(offer.id);
        const offerMetadata = (offer.metadata as Record<string, unknown> | null) || null;
        return {
          id: offer.id,
          title: offer.title,
          subject: offer.subject,
          amount: offer.amount,
          metadata: {
            ...offerMetadata,
            contractType: linkedContract?.contractType || null,
            department: linkedContract?.department || (offerMetadata as any)?.department || null,
            designation: linkedContract?.designation || offer.subject || null,
          },
        };
      });
  },

  async completeJoining(
    session: AppSession | null,
    input: {
      offerId: string;
      employeeCode: string;
      branchId: string;
      designation: string;
      department: string;
      shiftId: string;
      basicSalary: number;
      houseAllowance: number;
      transportAllowance: number;
      medicalAllowance: number;
      otherAllowance: number;
      providentFund: number;
      taxDeduction: number;
    },
  ) {
    const actor = await authorize(session, 'hr:write');

    const employeeCode = input.employeeCode.trim().toUpperCase();
    if (!input.offerId) throw new ValidationError('Job offer reference is required');
    if (!employeeCode) throw new ValidationError('Employee ID code is required');
    if (!input.branchId) throw new ValidationError('Branch assignment is required');
    if (!input.shiftId) throw new ValidationError('Shift assignment is required');
    if (!Number.isFinite(input.basicSalary) || input.basicSalary <= 0) {
      throw new ValidationError('Basic salary is required');
    }

    const salaryFields = {
      basicSalary: input.basicSalary,
      houseAllowance: input.houseAllowance,
      transportAllowance: input.transportAllowance,
      medicalAllowance: input.medicalAllowance,
      otherAllowance: input.otherAllowance,
      providentFund: input.providentFund,
      taxDeduction: input.taxDeduction,
    };
    const invalidSalaryField = Object.entries(salaryFields).find(([, value]) => !Number.isFinite(value) || value < 0);
    if (invalidSalaryField) throw new ValidationError(`${invalidSalaryField[0]} must be a valid non-negative number`);

    const offer = await prisma.hrWorkflowRecord.findUnique({ where: { id: input.offerId } });
    if (!offer || offer.section !== 'job-offers') throw new ValidationError('Job offer not found');

    const offerMeta = (offer.metadata as Record<string, any>) || {};
    const candidateId = offerMeta.candidateId;
    if (!candidateId) throw new ValidationError('Associated candidate not found');

    const candidate = await prisma.hrWorkflowRecord.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.section !== 'candidates') throw new ValidationError('Candidate record not found');

    const nameParts = candidate.title.split(' ');
    const firstName = nameParts[0] || 'Employee';
    const lastName = nameParts.slice(1).join(' ') || 'Record';

    const candidateMeta = (candidate.metadata as Record<string, any>) || {};
    const shift = await prisma.shift.findUnique({
      where: { id: input.shiftId },
      select: { id: true, name: true, code: true, branchId: true },
    });
    if (!shift) throw new ValidationError('Selected shift was not found');
    if (shift.branchId !== input.branchId) throw new ValidationError('Selected shift does not belong to the chosen branch');

    const offerContract = await prisma.contract.findFirst({
      where: { offerId: input.offerId },
      select: { id: true, status: true, contractType: true, department: true, designation: true },
    });
    if (!offerContract) throw new ValidationError('A signed offer contract is required before joining can be completed');
    if (!['SIGNED', 'WAITING_FOR_JOINING'].includes(offerContract.status)) {
      throw new ValidationError('Offer contract must be signed before joining can be completed');
    }

    const employmentType = employmentTypeFromContractType(offerContract.contractType);
    const designation = input.designation || offerContract.designation || candidate.subject || '';
    const department = input.department || offerContract.department || candidateMeta.department || '';

    return prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          branchId: input.branchId,
          code: employeeCode,
          firstName,
          lastName,
          email: candidateMeta.email || `${employeeCode.toLowerCase()}@annex.local`,
          phone: candidateMeta.phone || '',
          designation,
          department,
          employmentType,
          shiftId: shift.id,
          joinedAt: offer.startDate || new Date(),
          status: 'ACTIVE',
          basicSalary: input.basicSalary,
          houseAllowance: input.houseAllowance,
          transportAllowance: input.transportAllowance,
          medicalAllowance: input.medicalAllowance,
          otherAllowance: input.otherAllowance,
          providentFund: input.providentFund,
          taxDeduction: input.taxDeduction,
          bankName: '',
          bankAccount: '',
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      await tx.contract.update({
        where: { id: offerContract.id },
        data: {
          employeeId: emp.id,
          branchId: input.branchId,
          department,
          designation,
          contractType: employmentType === 'PERMANENT' ? 'PERMANENT' : 'CONTRACT',
          startDate: offer.startDate || new Date(),
          endDate: employmentType === 'PERMANENT' ? null : offer.endDate || null,
          basicSalary: input.basicSalary,
          shiftId: shift.id,
          status: 'ACTIVE',
          updatedById: actor.userId,
        },
      });

      await tx.hrWorkflowRecord.create({
        data: {
          branchId: input.branchId,
          section: 'joining',
          title: `Joining - ${candidate.title}`,
          subject: designation,
          status: 'Employee Created',
          startDate: offer.startDate,
          amount: input.basicSalary,
          notes: `Joined as ${designation} in ${department}. Employment Type: ${employmentType}. Shift: ${shift.name} (${shift.code})`,
          metadata: {
            candidateId,
            offerId: input.offerId,
            employeeId: emp.id,
            employeeCode: emp.code,
            designation,
            department,
            employmentType,
            shiftId: shift.id,
            shiftName: shift.name,
            salaryStructure: salaryFields,
            checklist: { documentsUploaded: true, accountCreated: true, contractSigned: true },
          },
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      await tx.hrWorkflowRecord.update({ where: { id: candidateId }, data: { status: 'Employee Created' } });
      await tx.hrWorkflowRecord.update({ where: { id: input.offerId }, data: { status: 'Joined' } });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'hr',
          action: 'complete-joining',
          entityType: 'Employee',
          entityId: emp.id,
          after: { code: emp.code, name: `${emp.firstName} ${emp.lastName}`, designation },
        },
        tx,
      );

      return emp;
    });
  },
};
