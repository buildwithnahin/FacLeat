import { z } from 'zod';

// Mirrors Prisma's `SalaryComponentCategory` / `SalaryComponentType` /
// `SalaryCalculationType` / `SalaryComponentStatus` enums — local string
// unions per web/'s no-direct-Prisma-access rule.
const SALARY_COMPONENT_CATEGORIES = ['EARNINGS', 'DEDUCTION'] as const;
const SALARY_COMPONENT_TYPES = ['FIXED', 'VARIABLE'] as const;
const SALARY_CALCULATION_TYPES = ['FIXED_AMOUNT', 'PERCENTAGE', 'FORMULA', 'MANUAL_ENTRY'] as const;
const SALARY_COMPONENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export const salaryComponentFormSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    code: z.string().min(2, 'Code must be at least 2 characters'),
    description: z.string().optional().nullable(),
    category: z.enum(SALARY_COMPONENT_CATEGORIES),
    type: z.enum(SALARY_COMPONENT_TYPES),
    calculationType: z.enum(SALARY_CALCULATION_TYPES),

    // Conditionally required/validated fields based on type
    value: z.number().optional().nullable(),
    formula: z.string().optional().nullable(),
    baseComponent: z.string().optional().nullable(),

    // Booleans
    isTaxable: z.boolean().default(true),
    includeInGross: z.boolean().default(true),
    includeInNet: z.boolean().default(true),
    showInPayslip: z.boolean().default(true),
    isSystemGenerated: z.boolean().default(false),

    isMandatory: z.boolean().default(false),
    isEditableDuringPayroll: z.boolean().default(false),
    allowNegativeValue: z.boolean().default(false),

    maxAmount: z.number().optional().nullable(),
    minAmount: z.number().optional().nullable(),

    status: z.enum(SALARY_COMPONENT_STATUSES).default('ACTIVE'),

    applicableEmploymentTypes: z.array(z.string()).default([]),
    applicableDepartments: z.array(z.string()).default([]),
    applicableDesignations: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.calculationType === 'PERCENTAGE' && (data.value === null || data.value === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage value is required when calculation type is PERCENTAGE',
        path: ['value'],
      });
    }
    if (data.calculationType === 'PERCENTAGE' && data.value !== null && data.value !== undefined) {
      if (data.value < 0 || data.value > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Percentage must be between 0 and 100',
          path: ['value'],
        });
      }
    }
    if (data.calculationType === 'FORMULA' && (!data.formula || data.formula.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Formula is required when calculation type is FORMULA',
        path: ['formula'],
      });
    }
  });

export type SalaryComponentFormValues = z.infer<typeof salaryComponentFormSchema>;
