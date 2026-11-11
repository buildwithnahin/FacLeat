import { z } from 'zod';

// Mirrors Prisma's `BonusType` / `BonusCalculationMethod` / `BonusBasedOn` /
// `BonusPaymentMethod` enums — local string unions per web/'s
// no-direct-Prisma-access rule.
const BONUS_TYPES = [
  'FESTIVAL',
  'ATTENDANCE',
  'PRODUCTION',
  'PERFORMANCE',
  'SALES_INCENTIVE',
  'SPECIAL',
  'YEARLY',
  'JOINING',
  'RETENTION',
  'OTHER',
] as const;
const BONUS_CALCULATION_METHODS = ['FIXED_AMOUNT', 'PERCENTAGE', 'FORMULA'] as const;
const BONUS_BASED_ON = ['BASIC_SALARY', 'GROSS_SALARY', 'NET_SALARY'] as const;
const BONUS_PAYMENT_METHODS = ['PAYROLL', 'CASH', 'BANK_TRANSFER'] as const;

export const bonusFormSchema = z
  .object({
    name: z.string().min(1, 'Bonus name is required'),
    code: z.string().min(1, 'Bonus code is required'),
    bonusType: z.enum(BONUS_TYPES),
    effectivePayrollMonth: z.string().min(1, 'Effective payroll month is required'),
    description: z.string().optional(),
    calculationMethod: z.enum(BONUS_CALCULATION_METHODS),
    amount: z.coerce.number().optional(),
    percentage: z.coerce.number().optional(),
    basedOn: z.enum(BONUS_BASED_ON).optional().nullable(),
    minimumServiceMonths: z.coerce.number().min(0).default(0),
    paymentMethod: z.enum(BONUS_PAYMENT_METHODS),
    paymentDate: z.coerce.date().optional().nullable(),
    includeInPayslip: z.boolean().default(true),
    employeeIds: z.array(z.string()).min(1, 'At least one employee must be selected'),
  })
  .superRefine((data, ctx) => {
    if (data.calculationMethod === 'FIXED_AMOUNT' && (!data.amount || data.amount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Amount is required and must be greater than 0 for Fixed Amount calculation',
        path: ['amount'],
      });
    }
    if (data.calculationMethod === 'PERCENTAGE' && (!data.percentage || data.percentage <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage is required and must be greater than 0 for Percentage calculation',
        path: ['percentage'],
      });
    }
    if (data.calculationMethod === 'PERCENTAGE' && !data.basedOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Based On (Basic/Gross/Net) is required for Percentage calculation',
        path: ['basedOn'],
      });
    }
  });

export type BonusFormValues = z.infer<typeof bonusFormSchema>;

export const bonusApprovalSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'PUBLISHED']),
  remarks: z.string().min(1, 'Remarks are required for approval actions').optional(),
});
