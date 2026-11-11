import { z } from 'zod';

export const LEAVE_TYPE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const LEAVE_TYPE_UNITS = ['FULL_DAY', 'HALF_DAY', 'HOURLY'] as const;
export const LEAVE_TYPE_GENDERS = ['ALL', 'MALE_ONLY', 'FEMALE_ONLY'] as const;
export const LEAVE_ATTACHMENT_TYPES = [
  'MEDICAL_CERTIFICATE',
  'MARRIAGE_CERTIFICATE',
  'DEATH_CERTIFICATE',
  'OTHERS',
] as const;

const optionalNumber = z
  .union([z.coerce.number().finite(), z.null(), z.undefined()])
  .transform((value) => (value == null || Number.isNaN(value) ? null : value));

const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== 'string') return '';
    return value.trim();
  });

const stringArray = z.array(z.string().trim().min(1).max(80)).default([]);

const leaveTypeBaseObjectSchema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Z0-9_/-]+$/i, 'Use letters, digits, slash, dash, or underscore'),
  name: z.string().trim().min(1).max(120),
  description: optionalString,
  status: z.enum(LEAVE_TYPE_STATUSES).default('ACTIVE'),
  paidLeave: z.boolean().default(true),
  annualEntitlement: optionalNumber,
  maxConsecutiveDays: optionalNumber,
  minimumLeaveDays: optionalNumber,
  applyBeforeDays: optionalNumber,
  unit: z.enum(LEAVE_TYPE_UNITS).default('FULL_DAY'),
  applicableEmploymentTypes: stringArray,
  genderApplicability: z.enum(LEAVE_TYPE_GENDERS).default('ALL'),
  applicableDepartment: optionalString,
  applicableDesignation: optionalString,
  applicableBranchId: optionalString,
  attachmentRequired: z.boolean().default(false),
  medicalCertificateRequired: z.boolean().default(false),
  allowHalfDay: z.boolean().default(false),
  allowBackdatedApplication: z.boolean().default(false),
  allowFutureApplication: z.boolean().default(true),
  approvalRequired: z.boolean().default(true),
  autoApprove: z.boolean().default(false),
  holidayIncluded: z.boolean().default(false),
  weekendIncluded: z.boolean().default(false),
  carryForwardAllowed: z.boolean().default(false),
  maximumCarryForwardDays: optionalNumber,
  carryForwardExpiryMonths: optionalNumber,
  requiredAttachmentTypes: z.array(z.enum(LEAVE_ATTACHMENT_TYPES)).default([]),
  allowNegativeBalance: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

const refineLeaveType = (
  value: z.infer<typeof leaveTypeBaseObjectSchema>,
  ctx: z.RefinementCtx,
) => {
  if (value.annualEntitlement != null && value.annualEntitlement < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Annual entitlement cannot be negative.',
      path: ['annualEntitlement'],
    });
  }

  if (value.maxConsecutiveDays != null && value.maxConsecutiveDays < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Maximum consecutive days cannot be negative.',
      path: ['maxConsecutiveDays'],
    });
  }

  if (value.minimumLeaveDays != null && value.minimumLeaveDays < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimum leave days cannot be negative.',
      path: ['minimumLeaveDays'],
    });
  }

  if (value.carryForwardAllowed && value.maximumCarryForwardDays != null && value.maximumCarryForwardDays < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Maximum carry forward days cannot be negative.',
      path: ['maximumCarryForwardDays'],
    });
  }
};

export const leaveTypeCreateSchema = leaveTypeBaseObjectSchema.superRefine(refineLeaveType);
export const leaveTypeUpdateSchema = leaveTypeBaseObjectSchema.extend({
  id: z.string().cuid(),
}).superRefine(refineLeaveType);

export type LeaveTypeCreateInput = z.infer<typeof leaveTypeCreateSchema>;
export type LeaveTypeUpdateInput = z.infer<typeof leaveTypeUpdateSchema>;
