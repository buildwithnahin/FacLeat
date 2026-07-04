import { z } from 'zod';
import { BonusType, BonusCalculationMethod, BonusBasedOn, BonusPaymentMethod } from '@prisma/client';

export const bonusFormSchema = z.object({
  name: z.string().min(1, 'Bonus name is required'),
  code: z.string().min(1, 'Bonus code is required'),
  bonusType: z.nativeEnum(BonusType),
  effectivePayrollMonth: z.string().min(1, 'Effective payroll month is required'),
  description: z.string().optional(),
  calculationMethod: z.nativeEnum(BonusCalculationMethod),
  amount: z.coerce.number().optional(),
  percentage: z.coerce.number().optional(),
  basedOn: z.nativeEnum(BonusBasedOn).optional().nullable(),
  minimumServiceMonths: z.coerce.number().min(0).default(0),
  paymentMethod: z.nativeEnum(BonusPaymentMethod),
  paymentDate: z.coerce.date().optional().nullable(),
  includeInPayslip: z.boolean().default(true),
  employeeIds: z.array(z.string()).min(1, 'At least one employee must be selected'),
}).superRefine((data, ctx) => {
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
