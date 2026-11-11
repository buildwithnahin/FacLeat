import { z } from 'zod';

export const SHIFT_TYPES = ['DAY', 'NIGHT', 'ROTATIONAL', 'FLEXIBLE'] as const;
export const SHIFT_STATUSES = ['ACTIVE', 'INACTIVE', 'DRAFT'] as const;
export const WEEK_DAYS = [
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
] as const;

const timeString = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format');

const baseShiftShape = {
  branchId: z.string().cuid(),
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(24)
    .regex(/^[A-Z0-9_-]+$/, 'A-Z, 0-9, _ or -'),
  status: z.enum(SHIFT_STATUSES).default('ACTIVE'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  shiftType: z.enum(SHIFT_TYPES),
  startTime: timeString,
  endTime: timeString,
  breakStart: timeString.optional().or(z.literal('')),
  breakEnd: timeString.optional().or(z.literal('')),
  lateGraceMinutes: z.coerce.number().int().min(0).max(240).default(15),
  earlyExitGraceMinutes: z.coerce.number().int().min(0).max(240).default(10),
  minPresentMinutes: z.coerce.number().int().min(1).max(1440),
  minHalfDayMinutes: z.coerce.number().int().min(1).max(1440),
  absentBelowMinutes: z.coerce.number().int().min(0).max(1440),
  overtimeAllowed: z.boolean().default(false),
  otStartsAfter: timeString.optional().or(z.literal('')),
  minOtMinutes: z.coerce.number().int().min(0).max(720).default(30),
  maxOtMinutesPerDay: z.coerce.number().int().min(0).max(1440).default(240),
  weeklyOffDays: z.array(z.enum(WEEK_DAYS)).default([]),
} satisfies z.ZodRawShape;

function withShiftRules<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((value, ctx) => {
    if ((value.breakStart && !value.breakEnd) || (!value.breakStart && value.breakEnd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['breakEnd'],
        message: 'Break start and break end must both be provided',
      });
    }
    if ((value.minHalfDayMinutes ?? 0) > (value.minPresentMinutes ?? 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minHalfDayMinutes'],
        message: 'Half-day minimum cannot exceed present minimum',
      });
    }
    if ((value.absentBelowMinutes ?? 0) > (value.minHalfDayMinutes ?? 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['absentBelowMinutes'],
        message: 'Absent threshold cannot exceed half-day minimum',
      });
    }
    if (value.overtimeAllowed && !value.otStartsAfter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['otStartsAfter'],
        message: 'OT start time is required when overtime is allowed',
      });
    }
  });
}

export const shiftCreateSchema = withShiftRules(baseShiftShape);
export const shiftUpdateSchema = withShiftRules({
  ...baseShiftShape,
  id: z.string().cuid(),
});

export type ShiftCreateInput = z.infer<typeof shiftCreateSchema>;
export type ShiftUpdateInput = z.infer<typeof shiftUpdateSchema>;
