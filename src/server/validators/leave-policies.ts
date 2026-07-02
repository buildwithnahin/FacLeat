import { z } from 'zod';
import { LEAVE_TYPES } from './hr';

export const LEAVE_POLICY_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED', 'ARCHIVED'] as const;
export const LEAVE_ACCRUAL_METHODS = [
  'YEARLY_ALLOCATION',
  'MONTHLY_ACCRUAL',
  'AFTER_CONFIRMATION',
  'AFTER_PROBATION',
  'MANUAL_ALLOCATION',
  'PRO_RATA_JOINING_DATE',
] as const;
export const LEAVE_PAYROLL_IMPACTS = [
  'NO_PAYROLL_IMPACT',
  'PAID_LEAVE',
  'UNPAID_LEAVE_DEDUCTION',
  'LEAVE_ENCASHMENT',
  'SALARY_HOLD',
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

export const leavePolicyRuleSchema = z.object({
  leaveType: z.enum(LEAVE_TYPES),
  leaveCode: z.string().trim().min(1).max(32),
  paidLeave: z.boolean().default(true),
  entitledDays: optionalNumber,
  isUnlimited: z.boolean().default(false),
  accrualMethod: z.enum(LEAVE_ACCRUAL_METHODS),
  minimumServiceMonths: optionalNumber,
  maxLeavePerRequest: optionalNumber,
  maxLeavePerMonth: optionalNumber,
  halfDayAllowed: z.boolean().default(false),
  attachmentRequired: z.boolean().default(false),
  reasonRequired: z.boolean().default(true),
  allowNegativeBalance: z.boolean().default(false),
  includeWeekend: z.boolean().default(false),
  includeHoliday: z.boolean().default(false),
  sandwichRuleApplicable: z.boolean().default(false),
  carryForwardAllowed: z.boolean().default(false),
  maxCarryForwardDays: optionalNumber,
  encashmentAllowed: z.boolean().default(false),
  maxEncashmentDays: optionalNumber,
  payrollImpact: z.enum(LEAVE_PAYROLL_IMPACTS),
  status: z.string().trim().min(1).max(40).default('ACTIVE'),
}).superRefine((value, ctx) => {
  if (!value.isUnlimited && (value.entitledDays == null || value.entitledDays < 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Entitled days is required unless the leave type is unlimited.',
      path: ['entitledDays'],
    });
  }

  if (value.carryForwardAllowed && value.maxCarryForwardDays != null && value.maxCarryForwardDays < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Max carry forward days cannot be negative.',
      path: ['maxCarryForwardDays'],
    });
  }

  if (value.encashmentAllowed && value.maxEncashmentDays != null && value.maxEncashmentDays < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Max encashment days cannot be negative.',
      path: ['maxEncashmentDays'],
    });
  }
});

const leavePolicyFields = {
  policyCode: z.string().trim().min(1).max(32),
  policyName: z.string().trim().min(1).max(120),
  branchId: optionalString,
  department: optionalString,
  designation: optionalString,
  employmentType: optionalString,
  employeeCategory: optionalString,
  gender: optionalString,
  grade: optionalString,
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.union([z.coerce.date(), z.null(), z.undefined()]).transform((value) => value ?? null),
  status: z.enum(LEAVE_POLICY_STATUSES).default('DRAFT'),
  description: optionalString,
  approvalRequired: z.boolean().default(true),
  managerApprovalRequired: z.boolean().default(true),
  hrApprovalRequired: z.boolean().default(true),
  accountsApprovalRequired: z.boolean().default(false),
  autoApproveAllowed: z.boolean().default(false),
  hrCanOverrideBalance: z.boolean().default(true),
  allowProbationEmployees: z.boolean().default(false),
  carryForwardAllowed: z.boolean().default(false),
  maxCarryForwardDays: optionalNumber,
  carryForwardExpiryMonth: optionalNumber,
  carryForwardExpiryDay: optionalNumber,
  encashmentAllowed: z.boolean().default(false),
  maxEncashmentDays: optionalNumber,
  autoClosing: z.boolean().default(false),
  payrollImpactDefault: z.enum(LEAVE_PAYROLL_IMPACTS).default('NO_PAYROLL_IMPACT'),
  assignedEmployeeIds: z.array(z.string().cuid()).default([]),
  rules: z.array(leavePolicyRuleSchema).min(1, 'At least one leave type rule is required.'),
} as const;

const baseLeavePolicyObjectSchema = z.object(leavePolicyFields);

const refineLeavePolicy = (
  value: z.infer<typeof baseLeavePolicyObjectSchema>,
  ctx: z.RefinementCtx
) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Effective to must be on or after effective from.',
      path: ['effectiveTo'],
    });
  }

  const uniqueTypes = new Set<string>();
  for (const rule of value.rules) {
    if (uniqueTypes.has(rule.leaveType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate rule for ${rule.leaveType}.`,
        path: ['rules'],
      });
    }
    uniqueTypes.add(rule.leaveType);
  }
};

export const leavePolicyCreateSchema = baseLeavePolicyObjectSchema.superRefine(refineLeavePolicy);
export const leavePolicyUpdateSchema = baseLeavePolicyObjectSchema.extend({
  id: z.string().cuid(),
}).superRefine(refineLeavePolicy);

export type LeavePolicyRuleInput = z.infer<typeof leavePolicyRuleSchema>;
export type LeavePolicyCreateInput = z.infer<typeof leavePolicyCreateSchema>;
export type LeavePolicyUpdateInput = z.infer<typeof leavePolicyUpdateSchema>;
