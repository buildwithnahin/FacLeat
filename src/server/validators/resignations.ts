import { z } from 'zod';

export const RESIGNATION_TYPES = ['VOLUNTARY', 'MUTUAL', 'RETIREMENT'] as const;
export const RESIGNATION_STATUSES = [
  'DRAFT',
  'PENDING_MANAGER_APPROVAL',
  'PENDING_HR_APPROVAL',
  'PENDING_ACCOUNTS_APPROVAL',
  'PENDING_EXIT_CLEARANCE',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'WITHDRAWN',
] as const;
export const RESIGNATION_REVIEW_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SENT_BACK',
  'HOLD',
  'CORRECTION_REQUESTED',
] as const;

export const EXIT_TYPES = ['RESIGNATION', 'TERMINATION', 'RETIREMENT', 'END_OF_CONTRACT', 'DEATH'] as const;
export const EXIT_CLEARANCE_STATUSES = [
  'DRAFT',
  'PENDING_DEPARTMENT_CLEARANCE',
  'PENDING_ACCOUNTS_APPROVAL',
  'PENDING_HR_APPROVAL',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const;
export const EXIT_CLEARANCE_REVIEW_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SENT_BACK',
  'HOLD',
  'NOT_REQUIRED',
] as const;
export const EXIT_ASSET_CONDITIONS = ['GOOD', 'DAMAGED', 'LOST'] as const;

export const RESIGNATION_TYPE_LABELS: Record<string, string> = {
  VOLUNTARY: 'Voluntary',
  MUTUAL: 'Mutual',
  RETIREMENT: 'Retirement',
};

export const RESIGNATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_MANAGER_APPROVAL: 'Pending Manager Approval',
  PENDING_HR_APPROVAL: 'Pending HR Approval',
  PENDING_ACCOUNTS_APPROVAL: 'Pending Accounts Approval',
  PENDING_EXIT_CLEARANCE: 'Pending Exit Clearance',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  WITHDRAWN: 'Withdrawn',
};

export const EXIT_TYPE_LABELS: Record<string, string> = {
  RESIGNATION: 'Resignation',
  TERMINATION: 'Termination',
  RETIREMENT: 'Retirement',
  END_OF_CONTRACT: 'End of Contract',
  DEATH: 'Death',
};

export const EXIT_CLEARANCE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_DEPARTMENT_CLEARANCE: 'Pending Department Clearance',
  PENDING_ACCOUNTS_APPROVAL: 'Pending Accounts Approval',
  PENDING_HR_APPROVAL: 'Pending HR Approval',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const EXIT_CLEARANCE_REVIEW_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SENT_BACK: 'Sent Back',
  HOLD: 'Hold',
  NOT_REQUIRED: 'Not Required',
};

export const EXIT_ASSET_CONDITION_LABELS: Record<string, string> = {
  GOOD: 'Good',
  DAMAGED: 'Damaged',
  LOST: 'Lost',
};

export const EXIT_DEPARTMENTS = [
  { key: 'REPORTING_MANAGER', label: 'Reporting Manager', roleLabel: 'Manager', sortOrder: 1 },
  { key: 'PRODUCTION', label: 'Production', roleLabel: 'Supervisor', sortOrder: 2 },
  { key: 'STORE', label: 'Store', roleLabel: 'Store Officer', sortOrder: 3 },
  { key: 'ADMIN', label: 'Admin', roleLabel: 'Admin Officer', sortOrder: 4 },
  { key: 'IT', label: 'IT', roleLabel: 'IT Officer', sortOrder: 5 },
  { key: 'SECURITY', label: 'Security', roleLabel: 'Security Officer', sortOrder: 6 },
  { key: 'ACCOUNTS', label: 'Accounts', roleLabel: 'Accountant', sortOrder: 7 },
  { key: 'HR', label: 'HR', roleLabel: 'HR Manager', sortOrder: 8 },
] as const;

export const EXIT_ASSETS = [
  { key: 'ID_CARD', label: 'ID Card', sortOrder: 1 },
  { key: 'LAPTOP', label: 'Laptop', sortOrder: 2 },
  { key: 'DESKTOP', label: 'Desktop', sortOrder: 3 },
  { key: 'MOBILE_PHONE', label: 'Mobile Phone', sortOrder: 4 },
  { key: 'SIM_CARD', label: 'SIM Card', sortOrder: 5 },
  { key: 'UNIFORM', label: 'Uniform', sortOrder: 6 },
  { key: 'LOCKER_KEY', label: 'Locker Key', sortOrder: 7 },
  { key: 'OFFICE_KEY', label: 'Office Key', sortOrder: 8 },
  { key: 'VEHICLE', label: 'Vehicle', sortOrder: 9 },
  { key: 'TOOLS_MACHINERY', label: 'Tools / Machinery', sortOrder: 10 },
  { key: 'DOCUMENTS', label: 'Documents', sortOrder: 11 },
  { key: 'ACCESS_CARD', label: 'Access Card', sortOrder: 12 },
] as const;

export const EXIT_SYSTEM_ACCESS_ITEMS = [
  { key: 'erpAccountDisabled', label: 'ERP Account Disabled' },
  { key: 'emailDisabled', label: 'Email Disabled' },
  { key: 'attendanceDeviceDisabled', label: 'Attendance Device Disabled' },
  { key: 'vpnDisabled', label: 'VPN Disabled' },
  { key: 'fingerprintRemoved', label: 'Fingerprint Removed' },
  { key: 'doorAccessRemoved', label: 'Door Access Removed' },
] as const;

const boolField = () =>
  z
    .union([z.literal('yes'), z.literal('no'), z.boolean(), z.undefined(), z.null(), z.literal('')])
    .transform((value) => value === 'yes' || value === true);

const moneyField = () => z.coerce.number().finite().min(0).optional().or(z.literal(''));

const resignationBaseShape = {
  employeeId: z.string().cuid(),
  resignationType: z.enum(RESIGNATION_TYPES),
  resignationDate: z.coerce.date(),
  lastWorkingDate: z.coerce.date(),
  noticeRequired: boolField(),
  noticePeriodDays: z.coerce.number().int().min(0),
  noticeServedDays: z.coerce.number().int().min(0).optional().or(z.literal('')),
  noticeWaived: boolField(),
  buyoutAmount: moneyField(),
  reason: z.string().trim().min(1, 'Reason for resignation is required').max(2000),
  employeeRemarks: z.string().trim().max(2000).optional().or(z.literal('')),
  attachmentUrl: z.string().trim().max(500).optional().or(z.literal('')),
  managerPerformance: z.string().trim().max(2000).optional().or(z.literal('')),
  currentProjects: z.string().trim().max(2000).optional().or(z.literal('')),
  handoverStatus: z.string().trim().max(2000).optional().or(z.literal('')),
  replacementNeeded: boolField(),
  assetsReturned: boolField(),
  managerRecommendation: z.string().trim().max(2000).optional().or(z.literal('')),
  attendanceVerified: boolField(),
  leaveBalanceVerified: boolField(),
  noticePeriodVerified: boolField(),
  documentsVerified: boolField(),
  policyVerified: boolField(),
  pendingSalary: moneyField(),
  leaveEncashment: moneyField(),
  bonus: moneyField(),
  overtime: moneyField(),
  loanDeduction: moneyField(),
  advanceDeduction: moneyField(),
  taxDeduction: moneyField(),
  gratuity: moneyField(),
} satisfies z.ZodRawShape;

function withResignationRules<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value: z.infer<T>, ctx) => {
    if (value.lastWorkingDate < value.resignationDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lastWorkingDate'],
        message: 'Last working date must be on or after the resignation date',
      });
    }

    const noticeRequired = Boolean(value.noticeRequired);
    const noticeWaived = Boolean(value.noticeWaived);
    const noticePeriodDays = Number(value.noticePeriodDays || 0);
    const noticeServedDays = value.noticeServedDays === '' || value.noticeServedDays == null ? 0 : Number(value.noticeServedDays);
    const buyoutAmount = value.buyoutAmount === '' || value.buyoutAmount == null ? 0 : Number(value.buyoutAmount);

    if (noticeRequired && !noticeWaived && noticeServedDays > noticePeriodDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['noticeServedDays'],
        message: 'Notice served cannot exceed the required notice period',
      });
    }

    if (noticeRequired && !noticeWaived && noticeServedDays < noticePeriodDays && buyoutAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['buyoutAmount'],
        message: 'Buyout amount is required when notice is short-served',
      });
    }
  });
}

export const resignationCreateSchema = withResignationRules(z.object(resignationBaseShape));

export const resignationUpdateSchema = withResignationRules(
  z.object({
    id: z.string().cuid(),
    ...resignationBaseShape,
  }),
);

export const resignationStatusActionSchema = z.object({
  id: z.string().cuid(),
  action: z.enum([
    'submit',
    'withdraw',
    'cancel',
    'manager_approve',
    'manager_reject',
    'manager_send_back',
    'hr_approve',
    'hr_reject',
    'hr_hold',
    'accounts_approve',
    'accounts_reject',
    'accounts_request_correction',
    'generate_acceptance_letter',
    'generate_experience_letter',
    'generate_relieving_letter',
    'archive_employee',
  ]),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
});

const exitDepartmentSchema = z.object({
  departmentKey: z.string().min(1),
  departmentName: z.string().min(1),
  responsiblePerson: z.string().trim().max(120).optional().or(z.literal('')),
  status: z.enum(EXIT_CLEARANCE_REVIEW_STATUSES),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
});

const exitAssetSchema = z.object({
  assetKey: z.string().min(1),
  assetName: z.string().min(1),
  returned: z.boolean(),
  condition: z.enum(EXIT_ASSET_CONDITIONS),
  deductionAmount: z.coerce.number().min(0),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
});

const exitSystemAccessSchema = z.object({
  erpAccountDisabled: z.boolean(),
  emailDisabled: z.boolean(),
  attendanceDeviceDisabled: z.boolean(),
  vpnDisabled: z.boolean(),
  fingerprintRemoved: z.boolean(),
  doorAccessRemoved: z.boolean(),
});

const exitSettlementSchema = z.object({
  pendingSalary: z.coerce.number().min(0),
  leaveEncashment: z.coerce.number().min(0),
  bonus: z.coerce.number().min(0),
  overtime: z.coerce.number().min(0),
  loanRecovery: z.coerce.number().min(0),
  advanceRecovery: z.coerce.number().min(0),
  assetDamageRecovery: z.coerce.number().min(0),
  noticePay: z.coerce.number().min(0),
  gratuity: z.coerce.number().min(0),
  taxDeduction: z.coerce.number().min(0),
  otherDeduction: z.coerce.number().min(0),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
});

const exitInterviewSchema = z.object({
  reasonForLeaving: z.string().trim().max(2000).optional().or(z.literal('')),
  companyRating: z.coerce.number().int().min(1).max(5).optional(),
  managerRating: z.coerce.number().int().min(1).max(5).optional(),
  suggestions: z.string().trim().max(2000).optional().or(z.literal('')),
  rehireEligible: z.boolean().optional(),
  interviewConductedBy: z.string().trim().max(120).optional().or(z.literal('')),
});

export const exitClearanceUpsertSchema = z
  .object({
    id: z.string().cuid().optional(),
    resignationId: z.string().cuid(),
    exitType: z.enum(EXIT_TYPES),
    reasonForExit: z.string().trim().max(2000).optional().or(z.literal('')),
    noticePeriodServed: z.boolean(),
    handoverCompleted: z.boolean(),
    replacementAssigned: z.boolean(),
    exitInterviewCompleted: z.boolean(),
    hrRemarks: z.string().trim().max(2000).optional().or(z.literal('')),
    departments: z.array(exitDepartmentSchema).min(1),
    assets: z.array(exitAssetSchema).min(1),
    systemAccess: exitSystemAccessSchema,
    settlement: exitSettlementSchema,
    interview: exitInterviewSchema,
  })
  .superRefine((value, ctx) => {
    for (const asset of value.assets) {
      if ((asset.condition === 'DAMAGED' || asset.condition === 'LOST') && asset.deductionAmount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['assets'],
          message: `Deduction amount is required for ${asset.assetName} when it is damaged or lost`,
        });
      }
    }
  });

export const exitClearanceStatusActionSchema = z.object({
  id: z.string().cuid(),
  action: z.enum([
    'submit',
    'cancel',
    'department_approve',
    'department_reject',
    'department_send_back',
    'accounts_approve',
    'accounts_reject',
    'accounts_recalculate',
    'hr_approve',
    'hr_hold',
    'hr_reject',
    'generate_relieving_letter',
    'generate_experience_letter',
    'generate_full_final_settlement',
    'generate_exit_clearance_certificate',
    'generate_no_due_certificate',
    'generate_service_certificate',
    'archive_employee',
  ]),
  departmentKey: z.string().trim().optional().or(z.literal('')),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type ResignationCreateInput = z.infer<typeof resignationCreateSchema>;
export type ResignationUpdateInput = z.infer<typeof resignationUpdateSchema>;
export type ResignationStatusActionInput = z.infer<typeof resignationStatusActionSchema>;
export type ExitClearanceUpsertInput = z.infer<typeof exitClearanceUpsertSchema>;
export type ExitClearanceStatusActionInput = z.infer<typeof exitClearanceStatusActionSchema>;
