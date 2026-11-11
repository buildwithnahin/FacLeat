import { z } from 'zod';

export const ATTENDANCE_ADJUSTMENT_TYPES = [
  'MISSING_CHECK_IN',
  'MISSING_CHECK_OUT',
  'WRONG_PUNCH',
  'MANUAL_ATTENDANCE',
  'SHIFT_CHANGE',
  'OFFICIAL_DUTY',
  'FIELD_WORK',
  'HOLIDAY_WORK',
  'OT_CORRECTION',
] as const;

export const ATTENDANCE_ADJUSTMENT_STATUSES = ['DRAFT', 'UPDATED', 'CANCELLED'] as const;

export const ADJUSTMENT_ATTENDANCE_STATUSES = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'HALF_DAY',
  'ON_LEAVE',
  'HOLIDAY',
  'WEEKEND',
  'OFFICIAL_DUTY',
] as const;

export const ATTENDANCE_ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  MISSING_CHECK_IN: 'Missing Check In',
  MISSING_CHECK_OUT: 'Missing Check Out',
  WRONG_PUNCH: 'Wrong Punch',
  MANUAL_ATTENDANCE: 'Manual Attendance',
  SHIFT_CHANGE: 'Shift Change',
  OFFICIAL_DUTY: 'Official Duty',
  FIELD_WORK: 'Field Work',
  HOLIDAY_WORK: 'Holiday Work',
  OT_CORRECTION: 'OT Correction',
};

export const ATTENDANCE_ADJUSTMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  UPDATED: 'Updated',
  CANCELLED: 'Cancelled',
};

export const ADJUSTMENT_STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  HALF_DAY: 'Half Day',
  ON_LEAVE: 'Leave',
  HOLIDAY: 'Holiday',
  WEEKEND: 'Weekend',
  OFFICIAL_DUTY: 'Official Duty',
};

const timeField = z.string().trim().optional().or(z.literal(''));

export const attendanceAdjustmentUpsertSchema = z
  .object({
    id: z.string().cuid().optional(),
    employeeId: z.string().cuid(),
    attendanceDate: z.coerce.date(),
    adjustmentType: z.enum(ATTENDANCE_ADJUSTMENT_TYPES),
    newCheckIn: timeField,
    newCheckOut: timeField,
    newStatus: z.enum(ADJUSTMENT_ATTENDANCE_STATUSES),
    newShiftId: z.string().cuid().optional().or(z.literal('')),
    reason: z.string().trim().min(1, 'Reason is required').max(2000),
    attachmentUrl: z.string().trim().max(500).optional().or(z.literal('')),
    remarks: z.string().trim().max(2000).optional().or(z.literal('')),
    intent: z.enum(['draft', 'apply']),
  })
  .superRefine((value, ctx) => {
    if (value.newCheckIn && value.newCheckOut) {
      const [inH, inM] = value.newCheckIn.split(':').map(Number);
      const [outH, outM] = value.newCheckOut.split(':').map(Number);
      if (
        inH !== undefined &&
        inM !== undefined &&
        outH !== undefined &&
        outM !== undefined &&
        !Number.isNaN(inH) &&
        !Number.isNaN(inM) &&
        !Number.isNaN(outH) &&
        !Number.isNaN(outM)
      ) {
        if (outH * 60 + outM <= inH * 60 + inM) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['newCheckOut'],
            message: 'New check-out must be after new check-in',
          });
        }
      }
    }
  });

export const attendanceAdjustmentCancelSchema = z.object({
  id: z.string().cuid(),
});

export type AttendanceAdjustmentUpsertInput = z.infer<typeof attendanceAdjustmentUpsertSchema>;
export type AttendanceAdjustmentCancelInput = z.infer<typeof attendanceAdjustmentCancelSchema>;
