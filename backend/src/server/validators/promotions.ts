import { z } from 'zod';

export const PROMOTION_TYPES = ['REGULAR', 'ADJUSTMENT', 'UPGRADE', 'ACTING'] as const;
export const PROMOTION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_MANAGER_APPROVAL',
  'PENDING_HR_APPROVAL',
  'APPROVED',
  'COMPLETED',
  'REJECTED_BY_MANAGER',
  'REJECTED_BY_HR',
] as const;

export const PROMOTION_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

export const PROMOTION_TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Regular Promotion',
  ADJUSTMENT: 'Adjustment Promotion',
  UPGRADE: 'Upgrade Promotion',
  ACTING: 'Acting Promotion',
};

export const PROMOTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_MANAGER_APPROVAL: 'Pending Manager Approval',
  PENDING_HR_APPROVAL: 'Pending HR Approval',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
  REJECTED_BY_MANAGER: 'Rejected by Manager',
  REJECTED_BY_HR: 'Rejected by HR',
};

const basePromotionFields = {
  employeeId: z.string().cuid(),
  promotionType: z.enum(PROMOTION_TYPES),
  newDesignation: z.string().trim().min(1, 'New designation is required').max(80),
  newSalary: z.coerce.number().finite().min(0.01, 'New salary is required'),
  effectiveDate: z.coerce.date(),
  reason: z.string().trim().min(1, 'Promotion reason is required').max(1000),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
} satisfies z.ZodRawShape;

export const promotionCreateSchema = z.object(basePromotionFields);

export const promotionUpdateSchema = z.object({
  id: z.string().cuid(),
  ...basePromotionFields,
});

export const promotionStatusActionSchema = z.object({
  id: z.string().cuid(),
  action: z.enum(['submit', 'manager_approve', 'manager_reject']),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
});

export type PromotionCreateInput = z.infer<typeof promotionCreateSchema>;
export type PromotionUpdateInput = z.infer<typeof promotionUpdateSchema>;
export type PromotionStatusActionInput = z.infer<typeof promotionStatusActionSchema>;
