import { z } from 'zod';

// Mirrors Prisma's `PayrollPeriodStatus` enum — see payroll-adjustment.ts
// for why this is a local string union instead of a `@prisma/client` import.
const PAYROLL_PERIOD_STATUSES = ['DRAFT', 'OPEN', 'CLOSED'] as const;

export const payrollPeriodFormSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    code: z.string().min(2, 'Code must be at least 2 characters'),
    month: z.number().min(1).max(12),
    year: z.number().min(2000).max(2100),

    startDate: z.string().or(z.date()).transform((val) => new Date(val)),
    endDate: z.string().or(z.date()).transform((val) => new Date(val)),
    processingDate: z
      .string()
      .or(z.date())
      .optional()
      .nullable()
      .transform((val) => (val ? new Date(val) : null)),
    paymentDate: z
      .string()
      .or(z.date())
      .optional()
      .nullable()
      .transform((val) => (val ? new Date(val) : null)),

    attendanceCutoffDate: z
      .string()
      .or(z.date())
      .optional()
      .nullable()
      .transform((val) => (val ? new Date(val) : null)),
    overtimeCutoffDate: z
      .string()
      .or(z.date())
      .optional()
      .nullable()
      .transform((val) => (val ? new Date(val) : null)),
    leaveCutoffDate: z
      .string()
      .or(z.date())
      .optional()
      .nullable()
      .transform((val) => (val ? new Date(val) : null)),

    includeAttendance: z.boolean().default(true),
    includeLeave: z.boolean().default(true),
    includeOvertime: z.boolean().default(true),
    includeBonus: z.boolean().default(true),
    includeLoanDeduction: z.boolean().default(true),
    includeSalaryAdvance: z.boolean().default(true),
    includeTax: z.boolean().default(true),

    allowReprocessing: z.boolean().default(false),
    autoCloseAfterPayroll: z.boolean().default(true),
    lockPayrollAfterClosing: z.boolean().default(true),

    status: z.enum(PAYROLL_PERIOD_STATUSES).default('DRAFT'),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End Date must be after Start Date',
        path: ['endDate'],
      });
    }
    if (data.paymentDate && data.paymentDate < data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment Date should ideally be after the period ends',
        path: ['paymentDate'],
      });
    }
  });

export type PayrollPeriodFormValues = z.infer<typeof payrollPeriodFormSchema>;

export const payrollPeriodStatusSchema = z.object({
  status: z.enum(PAYROLL_PERIOD_STATUSES),
  reason: z.string().optional(),
});
