import { z } from 'zod';
import { PayrollFrequency, SalaryStructureStatus } from '@prisma/client';

export const salaryStructureComponentSchema = z.object({
  salaryComponentId: z.string().min(1, 'Component ID is required'),
  value: z.number().min(0, 'Value must be at least 0'),
  isAutoCalculated: z.boolean().default(false),
});

export const salaryStructureFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters'),
  description: z.string().optional().nullable(),
  status: z.nativeEnum(SalaryStructureStatus).default('ACTIVE'),
  
  grossSalary: z.number().min(0, 'Gross salary must be at least 0'),
  netSalary: z.number().optional().nullable(),
  
  effectiveFrom: z.string().or(z.date()).transform(val => new Date(val)),
  effectiveTo: z.string().or(z.date()).optional().nullable().transform(val => val ? new Date(val) : null),
  payrollFrequency: z.nativeEnum(PayrollFrequency).default('MONTHLY'),
  currency: z.string().default('BDT'),
  
  employmentTypes: z.array(z.string()).default([]),
  departmentIds: z.array(z.string()).default([]),
  designationIds: z.array(z.string()).default([]),
  branchIds: z.array(z.string()).default([]),
  
  notes: z.string().optional().nullable(),
  
  components: z.array(salaryStructureComponentSchema).min(1, 'At least one component is required'),
});

export type SalaryStructureFormValues = z.infer<typeof salaryStructureFormSchema>;

export const salaryStructureAssignmentSchema = z.object({
  employeeIds: z.array(z.string()).min(1, 'At least one employee must be selected'),
  effectiveFrom: z.string().or(z.date()).transform(val => new Date(val)),
  effectiveTo: z.string().or(z.date()).optional().nullable().transform(val => val ? new Date(val) : null),
});

export type SalaryStructureAssignmentValues = z.infer<typeof salaryStructureAssignmentSchema>;
