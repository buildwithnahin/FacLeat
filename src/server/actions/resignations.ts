'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import {
  exitClearanceService,
  isEmployeeResignationTableMissingError,
  resignationsService,
  RESIGNATION_TABLE_UNAVAILABLE_MESSAGE,
} from '@/server/services/resignations.service';
import {
  EXIT_ASSETS,
  EXIT_DEPARTMENTS,
  exitClearanceStatusActionSchema,
  exitClearanceUpsertSchema,
  resignationCreateSchema,
  resignationStatusActionSchema,
  resignationUpdateSchema,
} from '@/server/validators/resignations';
import { ApiError } from '@/lib/errors';

export type ResignationFormState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined>; success?: boolean; id?: string }
  | undefined;

function parseBooleanField(fd: FormData, key: string) {
  return fd.get(key) ?? 'no';
}

function parseResignationForm(fd: FormData) {
  return {
    employeeId: fd.get('employeeId'),
    resignationType: fd.get('resignationType'),
    resignationDate: fd.get('resignationDate'),
    lastWorkingDate: fd.get('lastWorkingDate'),
    noticeRequired: parseBooleanField(fd, 'noticeRequired'),
    noticePeriodDays: fd.get('noticePeriodDays') ?? 0,
    noticeServedDays: fd.get('noticeServedDays') ?? 0,
    noticeWaived: parseBooleanField(fd, 'noticeWaived'),
    buyoutAmount: fd.get('buyoutAmount') ?? '',
    reason: fd.get('reason'),
    employeeRemarks: fd.get('employeeRemarks') ?? '',
    attachmentUrl: fd.get('attachmentUrl') ?? '',
    managerPerformance: fd.get('managerPerformance') ?? '',
    currentProjects: fd.get('currentProjects') ?? '',
    handoverStatus: fd.get('handoverStatus') ?? '',
    replacementNeeded: parseBooleanField(fd, 'replacementNeeded'),
    assetsReturned: parseBooleanField(fd, 'assetsReturned'),
    managerRecommendation: fd.get('managerRecommendation') ?? '',
    attendanceVerified: parseBooleanField(fd, 'attendanceVerified'),
    leaveBalanceVerified: parseBooleanField(fd, 'leaveBalanceVerified'),
    noticePeriodVerified: parseBooleanField(fd, 'noticePeriodVerified'),
    documentsVerified: parseBooleanField(fd, 'documentsVerified'),
    policyVerified: parseBooleanField(fd, 'policyVerified'),
    pendingSalary: fd.get('pendingSalary') ?? '',
    leaveEncashment: fd.get('leaveEncashment') ?? '',
    bonus: fd.get('bonus') ?? '',
    overtime: fd.get('overtime') ?? '',
    loanDeduction: fd.get('loanDeduction') ?? '',
    advanceDeduction: fd.get('advanceDeduction') ?? '',
    taxDeduction: fd.get('taxDeduction') ?? '',
    gratuity: fd.get('gratuity') ?? '',
  };
}

function parseExitClearanceForm(fd: FormData) {
  return {
    id: fd.get('id') || undefined,
    resignationId: fd.get('resignationId'),
    exitType: fd.get('exitType'),
    reasonForExit: fd.get('reasonForExit') ?? '',
    noticePeriodServed: parseBooleanField(fd, 'noticePeriodServed') === 'yes',
    handoverCompleted: parseBooleanField(fd, 'handoverCompleted') === 'yes',
    replacementAssigned: parseBooleanField(fd, 'replacementAssigned') === 'yes',
    exitInterviewCompleted: parseBooleanField(fd, 'exitInterviewCompleted') === 'yes',
    hrRemarks: fd.get('hrRemarks') ?? '',
    departments: EXIT_DEPARTMENTS.map((department) => ({
      departmentKey: department.key,
      departmentName: department.label,
      responsiblePerson: fd.get(`dept_${department.key}_responsiblePerson`) ?? '',
      status: fd.get(`dept_${department.key}_status`) ?? 'PENDING',
      remarks: fd.get(`dept_${department.key}_remarks`) ?? '',
    })),
    assets: EXIT_ASSETS.map((asset) => ({
      assetKey: asset.key,
      assetName: asset.label,
      returned: parseBooleanField(fd, `asset_${asset.key}_returned`) === 'yes',
      condition: fd.get(`asset_${asset.key}_condition`) ?? 'GOOD',
      deductionAmount: Number(fd.get(`asset_${asset.key}_deductionAmount`) ?? 0),
      remarks: fd.get(`asset_${asset.key}_remarks`) ?? '',
    })),
    systemAccess: {
      erpAccountDisabled: parseBooleanField(fd, 'erpAccountDisabled') === 'yes',
      emailDisabled: parseBooleanField(fd, 'emailDisabled') === 'yes',
      attendanceDeviceDisabled: parseBooleanField(fd, 'attendanceDeviceDisabled') === 'yes',
      vpnDisabled: parseBooleanField(fd, 'vpnDisabled') === 'yes',
      fingerprintRemoved: parseBooleanField(fd, 'fingerprintRemoved') === 'yes',
      doorAccessRemoved: parseBooleanField(fd, 'doorAccessRemoved') === 'yes',
    },
    settlement: {
      pendingSalary: Number(fd.get('pendingSalary') ?? 0),
      leaveEncashment: Number(fd.get('leaveEncashment') ?? 0),
      bonus: Number(fd.get('bonus') ?? 0),
      overtime: Number(fd.get('overtime') ?? 0),
      loanRecovery: Number(fd.get('loanRecovery') ?? 0),
      advanceRecovery: Number(fd.get('advanceRecovery') ?? 0),
      assetDamageRecovery: Number(fd.get('assetDamageRecovery') ?? 0),
      noticePay: Number(fd.get('noticePay') ?? 0),
      gratuity: Number(fd.get('gratuity') ?? 0),
      taxDeduction: Number(fd.get('taxDeduction') ?? 0),
      otherDeduction: Number(fd.get('otherDeduction') ?? 0),
      remarks: fd.get('settlementRemarks') ?? '',
    },
    interview: {
      reasonForLeaving: fd.get('reasonForLeaving') ?? '',
      companyRating: fd.get('companyRating') ? Number(fd.get('companyRating')) : undefined,
      managerRating: fd.get('managerRating') ? Number(fd.get('managerRating')) : undefined,
      suggestions: fd.get('suggestions') ?? '',
      rehireEligible: fd.get('rehireEligible')
        ? parseBooleanField(fd, 'rehireEligible') === 'yes'
        : undefined,
      interviewConductedBy: fd.get('interviewConductedBy') ?? '',
    },
  };
}

export async function createResignationAction(
  _prev: ResignationFormState,
  fd: FormData,
): Promise<ResignationFormState> {
  const parsed = resignationCreateSchema.safeParse(parseResignationForm(fd));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    const session = await getSession();
    const record = await resignationsService.create(session, parsed.data);
    revalidatePath('/hr/resignations');
    revalidatePath('/hr/exit-clearance');
    return { success: true, id: record.id };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    if (isEmployeeResignationTableMissingError(error)) return { error: RESIGNATION_TABLE_UNAVAILABLE_MESSAGE };
    throw error;
  }
}

export async function updateResignationAction(
  _prev: ResignationFormState,
  fd: FormData,
): Promise<ResignationFormState> {
  const parsed = resignationUpdateSchema.safeParse({
    id: fd.get('id'),
    ...parseResignationForm(fd),
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    const session = await getSession();
    await resignationsService.update(session, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    if (isEmployeeResignationTableMissingError(error)) return { error: RESIGNATION_TABLE_UNAVAILABLE_MESSAGE };
    throw error;
  }

  revalidatePath('/hr/resignations');
  revalidatePath('/hr/exit-clearance');
  redirect('/hr/resignations');
}

export async function changeResignationStatusAction(fd: FormData) {
  const parsed = resignationStatusActionSchema.safeParse({
    id: fd.get('id'),
    action: fd.get('action'),
    note: fd.get('note') ?? '',
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const message = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? 'Invalid resignation action';
    redirect(`/hr/resignations?error=${encodeURIComponent(message)}`);
  }

  const session = await getSession();
  try {
    await resignationsService.changeStatus(session, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(`/hr/resignations?error=${encodeURIComponent(error.message)}`);
    }
    if (isEmployeeResignationTableMissingError(error)) {
      redirect(`/hr/resignations?error=${encodeURIComponent(RESIGNATION_TABLE_UNAVAILABLE_MESSAGE)}`);
    }
    throw error;
  }

  revalidatePath('/hr/resignations');
  revalidatePath('/hr/exit-clearance');
  revalidatePath('/hr/employees');
  redirect('/hr/resignations');
}

export async function saveExitClearanceAction(
  _prev: ResignationFormState,
  fd: FormData,
): Promise<ResignationFormState> {
  const parsed = exitClearanceUpsertSchema.safeParse(parseExitClearanceForm(fd));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: flat.fieldErrors,
      error: flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0],
    };
  }

  try {
    const session = await getSession();
    const record = await exitClearanceService.upsert(session, parsed.data);
    revalidatePath('/hr/exit-clearance');
    revalidatePath('/hr/resignations');
    return { success: true, id: record.id };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    if (isEmployeeResignationTableMissingError(error)) return { error: RESIGNATION_TABLE_UNAVAILABLE_MESSAGE };
    throw error;
  }
}

export async function changeExitClearanceStatusAction(fd: FormData) {
  const parsed = exitClearanceStatusActionSchema.safeParse({
    id: fd.get('id'),
    action: fd.get('action'),
    departmentKey: fd.get('departmentKey') ?? '',
    note: fd.get('note') ?? '',
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const message = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0] ?? 'Invalid exit clearance action';
    redirect(`/hr/exit-clearance?error=${encodeURIComponent(message)}`);
  }

  const session = await getSession();
  try {
    await exitClearanceService.changeStatus(session, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(`/hr/exit-clearance?error=${encodeURIComponent(error.message)}`);
    }
    if (isEmployeeResignationTableMissingError(error)) {
      redirect(`/hr/exit-clearance?error=${encodeURIComponent(RESIGNATION_TABLE_UNAVAILABLE_MESSAGE)}`);
    }
    throw error;
  }

  revalidatePath('/hr/exit-clearance');
  revalidatePath('/hr/resignations');
  revalidatePath('/hr/employees');
  redirect('/hr/exit-clearance');
}
