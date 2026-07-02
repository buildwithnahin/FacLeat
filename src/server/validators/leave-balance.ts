import { z } from 'zod';
import { LEAVE_TYPES } from './hr';

export const LEAVE_BALANCE_ADJUSTMENT_TYPES = [
  'ADD_LEAVE',
  'DEDUCT_LEAVE',
  'CARRY_FORWARD_CORRECTION',
  'OPENING_BALANCE_CORRECTION',
  'SPECIAL_LEAVE_ADD',
  'LEAVE_ENCASHMENT_DEDUCTION',
] as const;

export const leaveBalanceAdjustmentSchema = z.object({
  employeeId: z.string().cuid(),
  leaveType: z.enum(LEAVE_TYPES),
  leaveYear: z.coerce.number().int().min(2000).max(2100),
  adjustmentType: z.enum(LEAVE_BALANCE_ADJUSTMENT_TYPES),
  adjustmentDays: z.coerce.number().finite().refine((value) => value !== 0, 'Adjustment days cannot be zero'),
  reason: z.string().trim().min(3, 'Reason is required').max(500),
  attachmentPath: z.string().trim().max(500).optional().or(z.literal('')).nullable(),
});

export type LeaveBalanceAdjustmentInput = z.infer<typeof leaveBalanceAdjustmentSchema>;
