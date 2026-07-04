import { z } from 'zod';

export const LEAVE_BALANCE_ADJUSTMENT_TYPES = [
  'CARRY_FORWARD_CORRECTION',
  'OPENING_BALANCE_CORRECTION',
] as const;

export const leaveBalanceAdjustmentSchema = z.object({
  employeeId: z.string().cuid(),
  leaveType: z.string().trim().min(1).max(40),
  leaveYear: z.coerce.number().int().min(2000).max(2100),
  adjustmentType: z.enum(LEAVE_BALANCE_ADJUSTMENT_TYPES),
  adjustmentDays: z.coerce.number().finite().refine((value) => value !== 0, 'Adjustment days cannot be zero'),
  reason: z.string().trim().min(3, 'Reason is required').max(500),
  attachmentPath: z.string().trim().max(500).optional().or(z.literal('')).nullable(),
});

export type LeaveBalanceAdjustmentInput = z.infer<typeof leaveBalanceAdjustmentSchema>;
