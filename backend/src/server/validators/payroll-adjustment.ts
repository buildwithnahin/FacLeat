import { z } from 'zod';
import { PayrollAdjustmentType, PayrollAdjustmentCategory, PayrollAdjustmentReason } from '@prisma/client';

export const payrollAdjustmentFormSchema = z.object({
  payrollPeriodId: z.string().min(1, 'Payroll Period is required'),
  employeeIds: z.array(z.string()).min(1, 'At least one employee must be selected'),
  adjustmentDate: z.string().min(1, 'Adjustment Date is required'),
  
  type: z.nativeEnum(PayrollAdjustmentType),
  category: z.nativeEnum(PayrollAdjustmentCategory).default('ONE_TIME'),
  
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero'),
  description: z.string().optional(),
  
  includeInGrossSalary: z.boolean().default(true),
  includeInTax: z.boolean().default(false),
  includeInPayslip: z.boolean().default(true),
  
  reason: z.nativeEnum(PayrollAdjustmentReason),
  remarks: z.string().optional(),
});

export type PayrollAdjustmentFormValues = z.infer<typeof payrollAdjustmentFormSchema>;

export const payrollAdjustmentApprovalSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().min(1, 'Remarks are required for approval actions').optional(),
});
