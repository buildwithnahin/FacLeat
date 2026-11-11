import { z } from 'zod';

export const leaveApplicationSchema = z.object({
  employeeId: z.string().cuid(),
  type: z.string().trim().min(1).max(40),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid from date format (YYYY-MM-DD)'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid to date format (YYYY-MM-DD)'),
  halfDay: z.boolean().default(false),
  halfDayType: z.enum(['FIRST_HALF', 'SECOND_HALF']).nullable().optional(),
  reason: z.string().trim().min(3, 'Reason is required (min 3 characters)'),
  attachmentPath: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  handoverEmployeeId: z.string().cuid().optional().nullable(),
}).refine((v) => {
  const from = new Date(v.fromDate);
  const to = new Date(v.toDate);
  if (to < from) return false;
  if (v.halfDay && v.fromDate !== v.toDate) return false;
  return true;
}, {
  message: 'To date must be on or after from date, and half day leaves must be on a single day.',
  path: ['toDate'],
});

export const leaveApprovalSchema = z.object({
  id: z.string().cuid(),
  stage: z.enum(['manager', 'hr']),
  action: z.enum(['approve', 'reject', 'return', 'cancel']),
  remarks: z.string().trim().max(500).optional().nullable(),
});

export type LeaveApplicationInput = z.infer<typeof leaveApplicationSchema>;
export type LeaveApprovalInput = z.infer<typeof leaveApprovalSchema>;
