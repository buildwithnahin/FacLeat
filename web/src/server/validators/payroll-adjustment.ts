import { z } from 'zod';

// Mirrors the Prisma enums of the same name (prisma/schema.prisma, owned by
// the backend) — declared locally as string unions instead of importing
// `@prisma/client`, per web/'s no-direct-Prisma-access rule (see
// web/src/lib/inventory-sections.ts for the established pattern).
const PAYROLL_ADJUSTMENT_TYPES = [
  'ALLOWANCE',
  'DEDUCTION',
  'BONUS_CORRECTION',
  'SALARY_CORRECTION',
  'TAX_ADJUSTMENT',
  'OVERTIME_ADJUSTMENT',
  'ATTENDANCE_ADJUSTMENT',
  'LOAN_ADJUSTMENT',
  'ADVANCE_ADJUSTMENT',
  'OTHER',
] as const;

const PAYROLL_ADJUSTMENT_CATEGORIES = ['ONE_TIME', 'RECURRING'] as const;

const PAYROLL_ADJUSTMENT_REASONS = [
  'ATTENDANCE_CORRECTION',
  'MANUAL_BONUS',
  'LATE_SALARY_REVISION',
  'OT_CORRECTION',
  'RECOVERY',
  'OTHER',
] as const;

export const payrollAdjustmentFormSchema = z.object({
  payrollPeriodId: z.string().min(1, 'Payroll Period is required'),
  employeeIds: z.array(z.string()).min(1, 'At least one employee must be selected'),
  adjustmentDate: z.string().min(1, 'Adjustment Date is required'),

  type: z.enum(PAYROLL_ADJUSTMENT_TYPES),
  category: z.enum(PAYROLL_ADJUSTMENT_CATEGORIES).default('ONE_TIME'),

  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
  description: z.string().optional(),

  includeInGrossSalary: z.boolean().default(true),
  includeInTax: z.boolean().default(false),
  includeInPayslip: z.boolean().default(true),

  reason: z.enum(PAYROLL_ADJUSTMENT_REASONS),
  remarks: z.string().optional(),
});

export type PayrollAdjustmentFormValues = z.infer<typeof payrollAdjustmentFormSchema>;

export const payrollAdjustmentApprovalSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().min(1, 'Remarks are required for approval actions').optional(),
});
