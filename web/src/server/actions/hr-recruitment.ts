'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch, backendUpload, BackendApiError } from '@/lib/backend-client';

export type ActionState =
  | {
      success?: boolean;
      error?: string;
      fieldErrors?: Record<string, string[]>;
      id?: string;
    }
  | undefined;

function errorState(e: unknown, fallback: string): ActionState {
  if (e instanceof BackendApiError) return { error: e.message };
  return { error: fallback };
}

// 1. Recruitment Requests
export async function createRecruitmentRequestAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const position = String(fd.get('position') || '').trim();
  const department = String(fd.get('department') || '').trim();
  const vacancies = Number(fd.get('vacancies') || 1);
  const reason = String(fd.get('reason') || '').trim();
  const salaryRange = String(fd.get('salaryRange') || '').trim();
  const expectedJoining = String(fd.get('expectedJoining') || '');
  const priority = String(fd.get('priority') || 'NORMAL');

  if (!position) return { error: 'Position is required' };
  if (!department) return { error: 'Department is required' };
  if (!expectedJoining) return { error: 'Expected joining date is required' };

  try {
    await backendFetch('/api/mobile/hr/recruitment/requests', {
      method: 'POST',
      body: JSON.stringify({ position, department, vacancies, reason, salaryRange, expectedJoining, priority }),
    });
  } catch (e) {
    return errorState(e, 'Failed to create recruitment request');
  }

  revalidatePath('/hr/recruitment');
  return { success: true };
}

export async function decideRecruitmentRequestAction(id: string, decision: 'Approved' | 'Rejected' | 'Cancelled'): Promise<ActionState> {
  try {
    await backendFetch(`/api/mobile/hr/recruitment/requests/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
  } catch (e) {
    return errorState(e, 'Failed to update recruitment request');
  }

  revalidatePath('/hr/recruitment');
  return { success: true };
}

// 2. Candidates
export async function createCandidateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const name = String(fd.get('name') || '').trim();
  const recruitmentRequestId = String(fd.get('recruitmentRequestId') || '');
  const cvFile = fd.get('cvFile');

  if (!name) return { error: 'Candidate name is required' };
  if (!recruitmentRequestId) return { error: 'Recruitment request reference is required' };
  if (cvFile !== null && !(cvFile instanceof File)) return { error: 'Invalid CV upload' };

  const form = new FormData();
  form.set('name', name);
  form.set('recruitmentRequestId', recruitmentRequestId);
  form.set('phone', String(fd.get('phone') || '').trim());
  form.set('email', String(fd.get('email') || '').trim());
  form.set('experience', String(fd.get('experience') || '').trim());
  form.set('education', String(fd.get('education') || '').trim());
  form.set('expectedSalary', String(Number(fd.get('expectedSalary') || 0)));
  form.set('source', String(fd.get('source') || 'LinkedIn').trim());
  if (cvFile instanceof File && cvFile.size > 0) form.set('cvFile', cvFile);

  try {
    await backendUpload('/api/mobile/hr/recruitment/candidates', form);
  } catch (e) {
    return errorState(e, 'Failed to create candidate');
  }

  revalidatePath('/hr/candidates');
  return { success: true };
}

export async function decideCandidateAction(id: string, status: 'Applied' | 'Shortlisted' | 'Passed' | 'Selected' | 'Rejected' | 'Joined' | 'Employee Created'): Promise<ActionState> {
  try {
    await backendFetch(`/api/mobile/hr/recruitment/candidates/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  } catch (e) {
    return errorState(e, 'Failed to update candidate status');
  }

  revalidatePath('/hr/candidates');
  return { success: true };
}

// 3. Interviews
export async function scheduleInterviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const candidateId = String(fd.get('candidateId') || '');
  const interviewDate = String(fd.get('interviewDate') || '');
  const interviewType = String(fd.get('interviewType') || 'Technical').trim();
  const panel = String(fd.get('panel') || '').trim();

  if (!candidateId) return { error: 'Candidate is required' };
  if (!interviewDate) return { error: 'Interview date is required' };

  try {
    await backendFetch('/api/mobile/hr/recruitment/interviews', {
      method: 'POST',
      body: JSON.stringify({ candidateId, interviewDate, interviewType, panel }),
    });
  } catch (e) {
    return errorState(e, 'Failed to schedule interview');
  }

  revalidatePath('/hr/interviews');
  revalidatePath('/hr/candidates');
  return { success: true };
}

export async function evaluateInterviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const interviewId = String(fd.get('interviewId') || '');
  const communication = Number(fd.get('communication') || 0);
  const technicalSkill = Number(fd.get('technicalSkill') || 0);
  const remarks = String(fd.get('remarks') || '').trim();
  const recommendation = String(fd.get('recommendation') || 'Passed');

  if (!interviewId) return { error: 'Interview ID is required' };

  try {
    await backendFetch(`/api/mobile/hr/recruitment/interviews/${interviewId}/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ communication, technicalSkill, remarks, recommendation }),
    });
  } catch (e) {
    return errorState(e, 'Failed to evaluate interview');
  }

  revalidatePath('/hr/interviews');
  revalidatePath('/hr/candidates');
  return { success: true };
}

// 4. Job Offers
export async function createJobOfferAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const candidateId = String(fd.get('candidateId') || '');
  const salary = Number(fd.get('salary') || 0);
  const joiningDate = String(fd.get('joiningDate') || '');
  const expiryDate = String(fd.get('expiryDate') || '');
  const notes = String(fd.get('notes') || '').trim();

  if (!candidateId) return { error: 'Candidate is required' };
  if (!salary) return { error: 'Salary is required' };
  if (!joiningDate) return { error: 'Joining date is required' };
  if (!expiryDate) return { error: 'Offer expiry date is required' };

  try {
    await backendFetch('/api/mobile/hr/recruitment/job-offers', {
      method: 'POST',
      body: JSON.stringify({ candidateId, salary, joiningDate, expiryDate, notes }),
    });
  } catch (e) {
    return errorState(e, 'Failed to create job offer');
  }

  revalidatePath('/hr/job-offers');
  revalidatePath('/hr/candidates');
  return { success: true };
}

export async function decideJobOfferAction(id: string, status: 'Offer Accepted' | 'Rejected' | 'Job Offer Sent'): Promise<ActionState> {
  try {
    await backendFetch(`/api/mobile/hr/recruitment/job-offers/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  } catch (e) {
    return errorState(e, 'Failed to update job offer status');
  }

  revalidatePath('/hr/job-offers');
  revalidatePath('/hr/candidates');
  revalidatePath('/hr/offer-contracts');
  return { success: true };
}

// 5. Joining (Convert to Employee)
export async function completeJoiningAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
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

  try {
    await backendFetch('/api/mobile/hr/recruitment/joining', {
      method: 'POST',
      body: JSON.stringify({
        offerId,
        employeeCode,
        branchId,
        designation,
        department,
        shiftId,
        basicSalary,
        houseAllowance,
        transportAllowance,
        medicalAllowance,
        otherAllowance,
        providentFund,
        taxDeduction,
      }),
    });
  } catch (e) {
    return errorState(e, 'Failed to complete joining workflow');
  }

  revalidatePath('/hr/joining');
  revalidatePath('/hr/job-offers');
  revalidatePath('/hr/candidates');
  revalidatePath('/hr/employees');
  revalidatePath('/hr/contracts');
  revalidatePath('/hr/offer-contracts');
  return { success: true };
}
