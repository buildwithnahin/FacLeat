import { z } from 'zod';

// Mirrors Prisma's `LoanType` / `LoanPurpose` / `LoanInstallmentType` /
// `LoanStatus` enums — local string unions per web/'s no-direct-Prisma-
// access rule.
export const LOAN_TYPES = ['EMPLOYEE_LOAN', 'SALARY_ADVANCE'] as const;
export const LOAN_PURPOSES = ['MEDICAL', 'EDUCATION', 'EMERGENCY', 'PERSONAL', 'FESTIVAL', 'HOUSE_RENT', 'OTHERS'] as const;
export const LOAN_INSTALLMENT_TYPES = ['MONTHLY', 'ONE_TIME'] as const;
export const LOAN_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_HR',
  'PENDING_ACCOUNTS',
  'PENDING_MANAGEMENT',
  'APPROVED',
  'DISBURSED',
  'ACTIVE',
  'COMPLETED',
  'REJECTED',
  'CLOSED',
] as const;

export const loanFormSchema = z
  .object({
    requestType: z.enum(LOAN_TYPES).default('EMPLOYEE_LOAN'),
    employeeId: z.string().min(1, 'Employee is required'),
    loanAmount: z.number().min(1, 'Amount must be greater than zero'),
    purpose: z.enum(LOAN_PURPOSES).default('OTHERS'),

    disbursementDate: z.string().or(z.date()).transform((val) => new Date(val)),
    repaymentStartMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid format. Use YYYY-MM'),

    installmentType: z.enum(LOAN_INSTALLMENT_TYPES).default('MONTHLY'),
    numberOfInstallments: z.number().min(1, 'Must have at least 1 installment'),
    monthlyDeduction: z.number().min(1, 'Deduction must be greater than zero'),

    remarks: z.string().optional().nullable(),
    status: z.enum(LOAN_STATUSES).default('DRAFT'),
  })
  .superRefine((data, ctx) => {
    if (data.requestType === 'SALARY_ADVANCE') {
      if (data.numberOfInstallments > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Salary advances are typically recovered in a single installment',
          path: ['numberOfInstallments'],
        });
      }
    }
  });

export type LoanFormValues = z.infer<typeof loanFormSchema>;

export const loanApprovalSchema = z.object({
  status: z.enum(LOAN_STATUSES),
  remarks: z.string().optional().nullable(),
});
