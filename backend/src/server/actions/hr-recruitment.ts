'use server';

import { revalidatePath } from 'next/cache';
import path from 'node:path';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { hrService } from '@/server/services/hr.service';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

export type ActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  id?: string;
};

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

const CV_UPLOAD_ROOT = path.resolve(process.cwd(), 'backend/upload/CV');
const ALLOWED_CV_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024;

function employmentTypeFromContractType(contractType: string | null | undefined) {
  if (contractType === 'INTERNSHIP') return 'INTERN';
  if (contractType === 'PERMANENT' || contractType === 'PROBATION' || contractType === 'CONTRACT') {
    return contractType;
  }
  return 'CONTRACT';
}

function sanitizeFilenameSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function storeCandidateCv(file: File, candidateId: string) {
  const extension = path.extname(file.name || '').toLowerCase();
  if (!ALLOWED_CV_EXTENSIONS.has(extension)) {
    throw new Error('CV must be a PDF, DOC, or DOCX file');
  }
  if (file.size > MAX_CV_SIZE_BYTES) {
    throw new Error('CV file size must be 5MB or less');
  }

  const safeCandidateId = sanitizeFilenameSegment(candidateId) || 'candidate';
  const generatedName = `${safeCandidateId}-${randomUUID()}${extension}`;
  const absolutePath = path.join(CV_UPLOAD_ROOT, generatedName);

  await mkdir(CV_UPLOAD_ROOT, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    storedName: generatedName,
    originalName: file.name,
    relativePath: path.posix.join('backend', 'upload', 'CV', generatedName),
    absolutePath,
  };
}

// 1. Recruitment Requests
export async function createRecruitmentRequestAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await getSession();
    const actor = await authorize(session, 'hr:write');

    const title = String(fd.get('position') || '').trim();
    const subject = String(fd.get('department') || '').trim();
    const vacancies = Number(fd.get('vacancies') || 1);
    const reason = String(fd.get('reason') || '').trim();
    const salaryRange = String(fd.get('salaryRange') || '').trim();
    const expectedJoiningStr = String(fd.get('expectedJoining') || '');
    const priority = String(fd.get('priority') || 'NORMAL');

    if (!title) return { error: 'Position is required' };
    if (!subject) return { error: 'Department is required' };
    if (!expectedJoiningStr) return { error: 'Expected joining date is required' };

    const expectedJoining = new Date(expectedJoiningStr);
    const department = await prisma.hrMasterData.findFirst({
      where: {
        type: 'departments',
        name: subject,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!department) return { error: 'Please select an active department from HR master data' };

    const count = await prisma.hrWorkflowRecord.count({
      where: {
        section: 'recruitment',
        createdAt: {
          gte: new Date(new Date().getFullYear(), 0, 1),
        },
      },
    });
    const requestNo = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    await prisma.$transaction(async (tx) => {
      const row = await tx.hrWorkflowRecord.create({
        data: {
          branchId: actor.activeBranchId ?? null,
          section: 'recruitment',
          title,
          subject,
          status: 'HR Review',
          priority,
          startDate: expectedJoining,
          amount: vacancies,
          owner: salaryRange,
          notes: reason,
          metadata: {
            requestNo,
            vacancies,
            salaryRange,
            reason,
            approvalFlow: RECRUITMENT_APPROVAL_STEPS.map((step) => ({
              role: step.role,
              status: step.status,
            })),
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
          after: { requestNo, title, subject, vacancies },
        },
        tx,
      );
    });

    revalidatePath('/hr/recruitment');
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to create recruitment request' };
  }
}

export async function decideRecruitmentRequestAction(id: string, decision: 'Approved' | 'Rejected' | 'Cancelled'): Promise<ActionState> {
  try {
    const session = await getSession();
    if (!session) throw new UnauthorizedError();

    await prisma.$transaction(async (tx) => {
      const record = await tx.hrWorkflowRecord.findUnique({ where: { id } });
      if (!record || record.section !== 'recruitment') {
        throw new Error('Recruitment request not found');
      }
      const isHrWriter = session.permissions.includes('hr:write');
      const canApprove = canApproveRecruitmentStep(session.roles ?? [], record.status);

      if (!isHrWriter && !canApprove) {
        throw new ForbiddenError('This recruitment step must be approved by the assigned ERP role');
      }

      const actor = isHrWriter ? await authorize(session, 'hr:write') : session;
      const step = currentRecruitmentStep(record.status);
      const nextStatus = decision === 'Approved' && step ? step.nextStatus : decision;
      const metadata = ((record.metadata as Record<string, any>) || {});
      const approvals = Array.isArray(metadata.approvals) ? metadata.approvals : [];

      await tx.hrWorkflowRecord.update({
        where: { id },
        data: {
          status: nextStatus,
          metadata: {
            ...metadata,
            approvals: decision === 'Approved'
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
    });

    revalidatePath('/hr/recruitment');
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to update recruitment request' };
  }
}

// 2. Candidates
export async function createCandidateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let uploadedCv: Awaited<ReturnType<typeof storeCandidateCv>> | null = null;
  try {
    const session = await getSession();
    const actor = await authorize(session, 'hr:write');

    const name = String(fd.get('name') || '').trim();
    const recruitmentRequestId = String(fd.get('recruitmentRequestId') || '');
    const phone = String(fd.get('phone') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const experience = String(fd.get('experience') || '').trim();
    const education = String(fd.get('education') || '').trim();
    const expectedSalary = Number(fd.get('expectedSalary') || 0);
    const source = String(fd.get('source') || 'LinkedIn').trim();
    const cvFile = fd.get('cvFile');

    if (!name) return { error: 'Candidate name is required' };
    if (!recruitmentRequestId) return { error: 'Recruitment request reference is required' };
    if (cvFile !== null && !(cvFile instanceof File)) return { error: 'Invalid CV upload' };

    // Fetch the recruitment request to get the position and department
    const req = await prisma.hrWorkflowRecord.findUnique({
      where: { id: recruitmentRequestId },
    });
    if (!req) return { error: 'Recruitment request not found' };
    const requestDepartment = req.subject || '';

    const count = await prisma.hrWorkflowRecord.count({
      where: { section: 'candidates' },
    });
    const candidateId = `CAN-${String(count + 1).padStart(5, '0')}`;
    uploadedCv = cvFile instanceof File && cvFile.size > 0 ? await storeCandidateCv(cvFile, candidateId) : null;

    await prisma.$transaction(async (tx) => {
      const row = await tx.hrWorkflowRecord.create({
        data: {
          branchId: req.branchId ?? actor.activeBranchId ?? null,
          section: 'candidates',
          title: name,
          subject: req.title, // Position
          status: 'Applied',
          priority: 'NORMAL',
          amount: expectedSalary,
          owner: source,
          notes: `${experience}\nEducation: ${education}`,
          metadata: {
            candidateId,
            recruitmentRequestId,
            department: requestDepartment,
            phone,
            email,
            experience,
            education,
            source,
            cvName: uploadedCv?.originalName || '',
            cvStoredName: uploadedCv?.storedName || '',
            cvPath: uploadedCv?.relativePath || '',
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
    });

    revalidatePath('/hr/candidates');
    return { success: true };
  } catch (e: any) {
    if (uploadedCv?.absolutePath) {
      await unlink(uploadedCv.absolutePath).catch(() => {});
    }
    return { error: e.message || 'Failed to create candidate' };
  }
}

export async function decideCandidateAction(id: string, status: 'Applied' | 'Shortlisted' | 'Passed' | 'Selected' | 'Rejected' | 'Joined' | 'Employee Created'): Promise<ActionState> {
  try {
    const session = await getSession();
    const actor = await authorize(session, 'hr:write');

    await prisma.$transaction(async (tx) => {
      const record = await tx.hrWorkflowRecord.findUnique({ where: { id } });
      if (!record || record.section !== 'candidates') {
        throw new Error('Candidate not found');
      }

      await tx.hrWorkflowRecord.update({
        where: { id },
        data: {
          status,
          updatedById: actor.userId,
        },
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
    });

    revalidatePath('/hr/candidates');
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to update candidate status' };
  }
}

// 3. Interviews
export async function scheduleInterviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await getSession();
    const actor = await authorize(session, 'hr:write');

    const candidateId = String(fd.get('candidateId') || '');
    const dateStr = String(fd.get('interviewDate') || '');
    const interviewType = String(fd.get('interviewType') || 'Technical').trim();
    const panel = String(fd.get('panel') || '').trim();

    if (!candidateId) return { error: 'Candidate is required' };
    if (!dateStr) return { error: 'Interview date is required' };

    const candidate = await prisma.hrWorkflowRecord.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.section !== 'candidates') {
      return { error: 'Candidate record not found' };
    }

    const interviewDate = new Date(dateStr);

    await prisma.$transaction(async (tx) => {
      const row = await tx.hrWorkflowRecord.create({
        data: {
          branchId: candidate.branchId ?? actor.activeBranchId ?? null,
          section: 'interviews',
          title: `Interview - ${candidate.title}`,
          subject: interviewType,
          status: 'Scheduled',
          startDate: interviewDate,
          owner: panel,
          metadata: {
            candidateId,
            candidateName: candidate.title,
            panel,
            interviewType,
          },
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      // Move the candidate out of the shortlist queue once an interview is booked.
      await tx.hrWorkflowRecord.update({
        where: { id: candidateId },
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
          after: { candidateName: candidate.title, interviewType, interviewDate },
        },
        tx,
      );
    });

    revalidatePath('/hr/interviews');
    revalidatePath('/hr/candidates');
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to schedule interview' };
  }
}

export async function evaluateInterviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await getSession();
    const actor = await authorize(session, 'hr:write');

    const interviewId = String(fd.get('interviewId') || '');
    const communication = Number(fd.get('communication') || 0);
    const technicalSkill = Number(fd.get('technicalSkill') || 0);
    const remarks = String(fd.get('remarks') || '').trim();
    const recommendation = String(fd.get('recommendation') || 'Passed'); // Passed / Hold / Rejected

    if (!interviewId) return { error: 'Interview ID is required' };

    await prisma.$transaction(async (tx) => {
      const interview = await tx.hrWorkflowRecord.findUnique({ where: { id: interviewId } });
      if (!interview || interview.section !== 'interviews') {
        throw new Error('Interview not found');
      }

      const meta = (interview.metadata as Record<string, any>) || {};
      const candidateId = meta.candidateId;

      await tx.hrWorkflowRecord.update({
        where: { id: interviewId },
        data: {
          status: 'Interview Completed',
          notes: remarks,
          amount: (communication + technicalSkill) / 2, // Store average score in amount
          metadata: {
            ...meta,
            recommendation,
            scores: {
              communication,
              technicalSkill,
            },
          },
          updatedById: actor.userId,
        },
      });

      // Keep the candidate pipeline aligned with the interview outcome.
      if (candidateId) {
        await tx.hrWorkflowRecord.update({
          where: { id: candidateId },
          data: { status: recommendation },
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'evaluate-interview',
          entityType: 'HrWorkflowRecord',
          entityId: interviewId,
          after: { recommendation, communication, technicalSkill },
        },
        tx,
      );
    });

    revalidatePath('/hr/interviews');
    revalidatePath('/hr/candidates');
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to evaluate interview' };
  }
}

// 4. Job Offers
export async function createJobOfferAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await getSession();
    const actor = await authorize(session, 'hr:write');

    const candidateId = String(fd.get('candidateId') || '');
    const offeredSalary = Number(fd.get('salary') || 0);
    const joiningDateStr = String(fd.get('joiningDate') || '');
    const expiryDateStr = String(fd.get('expiryDate') || '');
    const notes = String(fd.get('notes') || '').trim();

    if (!candidateId) return { error: 'Candidate is required' };
    if (!offeredSalary) return { error: 'Salary is required' };
    if (!joiningDateStr) return { error: 'Joining date is required' };
    if (!expiryDateStr) return { error: 'Offer expiry date is required' };

    const candidate = await prisma.hrWorkflowRecord.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.section !== 'candidates') {
      return { error: 'Candidate not found' };
    }

    const candidateMeta = (candidate.metadata as Record<string, any>) || {};
    const requestDepartment =
      typeof candidateMeta.department === 'string' && candidateMeta.department.trim()
        ? candidateMeta.department.trim()
        : (() => {
            const recruitmentRequestId = typeof candidateMeta.recruitmentRequestId === 'string'
              ? candidateMeta.recruitmentRequestId
              : '';
            return recruitmentRequestId;
          })();

    let resolvedDepartment = typeof candidateMeta.department === 'string' ? candidateMeta.department.trim() : '';
    if (!resolvedDepartment && typeof requestDepartment === 'string' && requestDepartment) {
      const recruitmentRequest = await prisma.hrWorkflowRecord.findUnique({
        where: { id: requestDepartment },
        select: { subject: true },
      });
      resolvedDepartment = recruitmentRequest?.subject?.trim() || '';
    }

    const count = await prisma.hrWorkflowRecord.count({ where: { section: 'job-offers' } });
    const offerNo = `OFF-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    await prisma.$transaction(async (tx) => {
      const row = await tx.hrWorkflowRecord.create({
        data: {
          branchId: candidate.branchId ?? actor.activeBranchId ?? null,
          section: 'job-offers',
          title: offerNo,
          subject: candidate.subject, // Position
          status: 'Job Offer Sent',
          startDate: new Date(joiningDateStr),
          endDate: new Date(expiryDateStr),
          amount: offeredSalary,
          notes,
          metadata: {
            candidateId,
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

      // Advance the candidate into the offer stage once the offer is issued.
      await tx.hrWorkflowRecord.update({
        where: { id: candidateId },
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
          after: { offerNo, candidateName: candidate.title, salary: offeredSalary },
        },
        tx,
      );
    });

    revalidatePath('/hr/job-offers');
    revalidatePath('/hr/candidates');
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to create job offer' };
  }
}

export async function decideJobOfferAction(id: string, status: 'Offer Accepted' | 'Rejected' | 'Job Offer Sent'): Promise<ActionState> {
  try {
    const session = await getSession();
    const actor = await authorize(session, 'hr:write');

    await prisma.$transaction(async (tx) => {
      const offer = await tx.hrWorkflowRecord.findUnique({ where: { id } });
      if (!offer || offer.section !== 'job-offers') {
        throw new Error('Job offer not found');
      }

      const meta = (offer.metadata as Record<string, any>) || {};
      const candidateId = meta.candidateId;

      await tx.hrWorkflowRecord.update({
        where: { id },
        data: {
          status,
          updatedById: actor.userId,
        },
      });

      if (status === 'Offer Accepted') {
        const existingContract = await tx.contract.findFirst({
          where: { offerId: id },
          select: { id: true },
        });

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

      // Keep the candidate workflow aligned with the offer outcome.
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
    });

    revalidatePath('/hr/job-offers');
    revalidatePath('/hr/candidates');
    revalidatePath('/hr/offer-contracts');
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to update job offer status' };
  }
}

// 5. Joining (Convert to Employee)
export async function completeJoiningAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const session = await getSession();
    const actor = await authorize(session, 'hr:write');

    const offerId = String(fd.get('offerId') || '');
    const employeeCode = String(fd.get('employeeId') || '').trim().toUpperCase();
    const branchId = String(fd.get('branchId') || '');
    const designation = String(fd.get('designation') || '').trim();
    const department = String(fd.get('department') || '').trim();
    const shiftId = String(fd.get('shiftId') || '');
    const basicSalary = Number(fd.get('basicSalary') || 0);
    const houseAllowance = Number(fd.get('houseAllowance') || 0);
    const transportAllowance = Number(fd.get('transportAllowance') || 0);
    const medicalAllowance = Number(fd.get('medicalAllowance') || 0);
    const otherAllowance = Number(fd.get('otherAllowance') || 0);
    const providentFund = Number(fd.get('providentFund') || 0);
    const taxDeduction = Number(fd.get('taxDeduction') || 0);
    if (!offerId) return { error: 'Job offer reference is required' };
    if (!employeeCode) return { error: 'Employee ID code is required' };
    if (!branchId) return { error: 'Branch assignment is required' };
    if (!shiftId) return { error: 'Shift assignment is required' };
    if (!Number.isFinite(basicSalary) || basicSalary <= 0) return { error: 'Basic salary is required' };

    const salaryFields = {
      basicSalary,
      houseAllowance,
      transportAllowance,
      medicalAllowance,
      otherAllowance,
      providentFund,
      taxDeduction,
    };
    const invalidSalaryField = Object.entries(salaryFields).find(([, value]) => !Number.isFinite(value) || value < 0);
    if (invalidSalaryField) {
      return { error: `${invalidSalaryField[0]} must be a valid non-negative number` };
    }

    const offer = await prisma.hrWorkflowRecord.findUnique({ where: { id: offerId } });
    if (!offer || offer.section !== 'job-offers') {
      return { error: 'Job offer not found' };
    }

    const offerMeta = (offer.metadata as Record<string, any>) || {};
    const candidateId = offerMeta.candidateId;

    if (!candidateId) return { error: 'Associated candidate not found' };

    const candidate = await prisma.hrWorkflowRecord.findUnique({ where: { id: candidateId } });
    if (!candidate || candidate.section !== 'candidates') {
      return { error: 'Candidate record not found' };
    }

    // Split name into first and last name
    const nameParts = candidate.title.split(' ');
    const firstName = nameParts[0] || 'Employee';
    const lastName = nameParts.slice(1).join(' ') || 'Record';

    const candidateMeta = (candidate.metadata as Record<string, any>) || {};
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { id: true, name: true, code: true, branchId: true },
    });
    if (!shift) return { error: 'Selected shift was not found' };
    if (shift.branchId !== branchId) return { error: 'Selected shift does not belong to the chosen branch' };

    const offerContract = await prisma.contract.findFirst({
      where: { offerId },
      select: { id: true, status: true, contractType: true, department: true, designation: true },
    });

    if (!offerContract) {
      return { error: 'A signed offer contract is required before joining can be completed' };
    }
    if (!['SIGNED', 'WAITING_FOR_JOINING'].includes(offerContract.status)) {
      return { error: 'Offer contract must be signed before joining can be completed' };
    }

    const employmentType = employmentTypeFromContractType(offerContract.contractType);

    const employeeData = {
      branchId,
      code: employeeCode,
      firstName,
      lastName,
      email: candidateMeta.email || `${employeeCode.toLowerCase()}@annex.local`,
      phone: candidateMeta.phone || '',
      designation: designation || offerContract.designation || candidate.subject || '',
      department: department || offerContract.department || candidateMeta.department || '',
      employmentType,
      shiftId: shift.id,
      joinedAt: offer.startDate || new Date(),
      status: 'ACTIVE' as const,
      basicSalary,
      houseAllowance,
      transportAllowance,
      medicalAllowance,
      otherAllowance,
      providentFund,
      taxDeduction,
      bankName: '',
      bankAccount: '',
    };

    // Let's run inside a database transaction
    await prisma.$transaction(async (tx) => {
      // 1. Create employee
      const emp = await tx.employee.create({
        data: {
          ...employeeData,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      await tx.contract.update({
        where: { id: offerContract.id },
        data: {
          employeeId: emp.id,
          branchId,
          department: department || offerContract.department || candidateMeta.department || '',
          designation: designation || offerContract.designation || candidate.subject || '',
          contractType: employmentType === 'PERMANENT' ? 'PERMANENT' : 'CONTRACT',
          startDate: offer.startDate || new Date(),
          endDate: employmentType === 'PERMANENT' ? null : offer.endDate || null,
          basicSalary,
          shiftId: shift.id,
          status: 'ACTIVE',
          updatedById: actor.userId,
        },
      });

      // 2. Create joining record in workflow
      await tx.hrWorkflowRecord.create({
        data: {
          branchId,
          section: 'joining',
          title: `Joining - ${candidate.title}`,
          subject: designation,
          status: 'Employee Created',
          startDate: offer.startDate,
          amount: basicSalary,
          notes: `Joined as ${designation || offerContract.designation || candidate.subject || ''} in ${department || offerContract.department || candidateMeta.department || ''}. Employment Type: ${employmentType}. Shift: ${shift.name} (${shift.code})`,
          metadata: {
            candidateId,
            offerId,
            employeeId: emp.id,
            employeeCode: emp.code,
            designation: designation || offerContract.designation || candidate.subject || '',
            department: department || offerContract.department || candidateMeta.department || '',
            employmentType,
            shiftId: shift.id,
            shiftName: shift.name,
            salaryStructure: {
              basicSalary,
              houseAllowance,
              transportAllowance,
              medicalAllowance,
              otherAllowance,
              providentFund,
              taxDeduction,
            },
            checklist: {
              documentsUploaded: true,
              accountCreated: true,
              contractSigned: true,
            },
          },
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      // 3. Mark candidate as completed in the recruitment workflow.
      await tx.hrWorkflowRecord.update({
        where: { id: candidateId },
        data: { status: 'Employee Created' },
      });

      // 4. Mark offer as Joined
      await tx.hrWorkflowRecord.update({
        where: { id: offerId },
        data: { status: 'Joined' },
      });

      // 5. Audit logs
      await recordAudit(
        {
          actorId: actor.userId,
          branchId,
          module: 'hr',
          action: 'complete-joining',
          entityType: 'Employee',
          entityId: emp.id,
          after: { code: emp.code, name: `${emp.firstName} ${emp.lastName}`, designation },
        },
        tx,
      );
    });

    revalidatePath('/hr/joining');
    revalidatePath('/hr/job-offers');
    revalidatePath('/hr/candidates');
    revalidatePath('/hr/employees');
    revalidatePath('/hr/contracts');
    revalidatePath('/hr/offer-contracts');
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to complete joining workflow' };
  }
}
