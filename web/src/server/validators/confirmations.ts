import { z } from 'zod';

export const CONFIRMATION_TYPES = ['PROBATION_TO_PERMANENT', 'INTERNSHIP_TO_PERMANENT'] as const;
export const CONFIRMATION_STATUSES = [
  'DRAFT',
  'PENDING_MANAGER_APPROVAL',
  'PENDING_HR_APPROVAL',
  'PENDING_ACCOUNTS_APPROVAL',
  'CONFIRMED',
  'EXTENDED',
  'REJECTED',
  'CANCELLED',
  'SENT_BACK',
] as const;
export const CONFIRMATION_REVIEW_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SENT_BACK',
  'EXTENDED',
  'REVISION_REQUESTED',
] as const;

export const CONFIRMATION_TYPE_LABELS: Record<string, string> = {
  PROBATION_TO_PERMANENT: 'Probation to Permanent',
  INTERNSHIP_TO_PERMANENT: 'Internship to Permanent',
};

export const CONFIRMATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_MANAGER_APPROVAL: 'Pending Manager Approval',
  PENDING_HR_APPROVAL: 'Pending HR Approval',
  PENDING_ACCOUNTS_APPROVAL: 'Pending Accounts Approval',
  CONFIRMED: 'Confirmed',
  EXTENDED: 'Extended',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  SENT_BACK: 'Sent Back',
};

const baseConfirmationShape = {
  employeeId: z.string().cuid(),
  confirmationType: z.enum(CONFIRMATION_TYPES),
  probationEndDate: z.coerce.date().optional().or(z.literal('')),
  effectiveDate: z.coerce.date(),
  salaryRevisionRequired: z
    .union([z.literal('yes'), z.literal('no'), z.boolean(), z.undefined(), z.null()])
    .transform((value) => value === 'yes' || value === true),
  incrementAmount: z.coerce.number().finite().min(0).optional().or(z.literal('')),
  benefitsRevision: z.string().trim().max(2000).optional().or(z.literal('')),
  reason: z.string().trim().min(1, 'Reason is required').max(1000),
  performanceSummary: z.string().trim().max(2000).optional().or(z.literal('')),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
} satisfies z.ZodRawShape;

function withConfirmationRules<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value: z.infer<T>, ctx) => {
    const salaryRevisionRequired = Boolean(value.salaryRevisionRequired);
    const incrementAmount = value.incrementAmount === '' || value.incrementAmount == null ? undefined : Number(value.incrementAmount);
    if (salaryRevisionRequired && (!incrementAmount || incrementAmount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['incrementAmount'],
        message: 'Increment amount is required when salary revision is enabled',
      });
    }
  });
}

export const confirmationCreateSchema = withConfirmationRules(z.object(baseConfirmationShape));

export const confirmationUpdateSchema = withConfirmationRules(
  z.object({
    id: z.string().cuid(),
    ...baseConfirmationShape,
  }),
);

export const confirmationStatusActionSchema = z.object({
  id: z.string().cuid(),
  action: z.enum([
    'submit',
    'manager_approve',
    'manager_reject',
    'manager_send_back',
    'manager_extend',
    'hr_approve',
    'hr_reject',
    'hr_send_back',
    'hr_extend',
    'accounts_approve',
    'accounts_reject',
    'accounts_request_revision',
    'cancel',
  ]),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
});

export type ConfirmationCreateInput = z.infer<typeof confirmationCreateSchema>;
export type ConfirmationUpdateInput = z.infer<typeof confirmationUpdateSchema>;
export type ConfirmationStatusActionInput = z.infer<typeof confirmationStatusActionSchema>;
