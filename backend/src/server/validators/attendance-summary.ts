import { z } from 'zod';

export const ATTENDANCE_SUMMARY_STATUSES = [
  'GENERATED',
  'UNDER_REVIEW',
  'ADJUSTMENT_REQUIRED',
  'READY_FOR_PAYROLL',
  'LOCKED',
  'SENT_TO_PAYROLL',
  'PAYROLL_PROCESSED',
  'CANCELLED',
] as const;

export const ATTENDANCE_SUMMARY_STATUS_LABELS: Record<string, string> = {
  GENERATED: 'Generated',
  UNDER_REVIEW: 'Under Review',
  ADJUSTMENT_REQUIRED: 'Adjustment Required',
  READY_FOR_PAYROLL: 'Ready for Payroll',
  LOCKED: 'Locked',
  SENT_TO_PAYROLL: 'Sent to Payroll',
  PAYROLL_PROCESSED: 'Payroll Processed',
  CANCELLED: 'Cancelled',
};

// Generate summary records for a month
export const attendanceSummaryGenerateSchema = z.object({
  summaryMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (YYYY-MM)'),
  branchId: z.string().cuid(),
  department: z.string().trim().optional().or(z.literal('')),
  shiftId: z.string().cuid().optional().or(z.literal('')),
  employeeId: z.string().cuid().optional().or(z.literal('')),
});

// Single record actions
export const attendanceSummaryActionSchema = z.object({
  id: z.string().cuid(),
  action: z.enum([
    'recalculate',
    'lock',
    'unlock',
    'send-payroll',
    'require-adjustment',
    'mark-ready',
  ]),
});

// Bulk actions (e.g., lock all selected, send all to payroll)
export const attendanceSummaryBulkActionSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, 'Select at least one record'),
  action: z.enum(['lock', 'unlock', 'send-payroll', 'recalculate']),
});

export type AttendanceSummaryGenerateInput = z.infer<typeof attendanceSummaryGenerateSchema>;
export type AttendanceSummaryActionInput = z.infer<typeof attendanceSummaryActionSchema>;
export type AttendanceSummaryBulkActionInput = z.infer<typeof attendanceSummaryBulkActionSchema>;
