import { z } from 'zod';

export const INCREMENT_TYPES = ['ANNUAL', 'PERFORMANCE', 'MERIT', 'ADJUSTMENT', 'SPECIAL'] as const;
export const INCREMENT_METHODS = ['PERCENTAGE', 'FIXED_AMOUNT'] as const;
export const INCREMENT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_HR_APPROVAL',
  'PENDING_ACCOUNTS_APPROVAL',
  'PENDING_MANAGER_APPROVAL',
  'APPROVED',
  'APPLIED',
  'REJECTED',
] as const;
export const INCREMENT_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const INCREMENT_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Annual Increment',
  PERFORMANCE: 'Performance Increment',
  MERIT: 'Merit Increment',
  ADJUSTMENT: 'Adjustment Increment',
  SPECIAL: 'Special Increment',
};

export const INCREMENT_METHOD_LABELS: Record<string, string> = {
  PERCENTAGE: 'Percentage',
  FIXED_AMOUNT: 'Fixed Amount',
};

export const INCREMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_HR_APPROVAL: 'Pending HR Approval',
  PENDING_ACCOUNTS_APPROVAL: 'Pending Accounts Approval',
  PENDING_MANAGER_APPROVAL: 'Pending Manager Approval',
  APPROVED: 'Approved',
  APPLIED: 'Applied',
  REJECTED: 'Rejected',
};

const baseIncrementFields = {
  employeeId: z.string().cuid(),
  incrementType: z.enum(INCREMENT_TYPES),
  incrementMethod: z.enum(INCREMENT_METHODS),
  incrementValue: z.coerce.number().finite().min(0.01, 'Increment value is required'),
  effectiveDate: z.coerce.date(),
  reason: z.string().trim().min(1, 'Reason is required').max(1000),
  performanceSummary: z.string().trim().max(2000).optional().or(z.literal('')),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
} satisfies z.ZodRawShape;

export const incrementCreateSchema = z.object(baseIncrementFields);

export const incrementUpdateSchema = z.object({
  id: z.string().cuid(),
  ...baseIncrementFields,
});

export const incrementStatusActionSchema = z.object({
  id: z.string().cuid(),
  action: z.enum([
    'submit',
    'hr_approve',
    'hr_reject',
    'accounts_approve',
    'accounts_reject',
    'manager_approve',
    'manager_reject',
    'apply',
  ]),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
  budgetVerified: z
    .union([z.literal('yes'), z.literal('no'), z.boolean(), z.undefined(), z.null()])
    .transform((value) => {
      if (value === 'yes' || value === true) return true;
      if (value === 'no' || value === false) return false;
      return undefined;
    }),
});

export type IncrementCreateInput = z.infer<typeof incrementCreateSchema>;
export type IncrementUpdateInput = z.infer<typeof incrementUpdateSchema>;
export type IncrementStatusActionInput = z.infer<typeof incrementStatusActionSchema>;
