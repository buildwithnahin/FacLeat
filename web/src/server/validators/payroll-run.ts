import { z } from 'zod';

export const calculatePayrollSchema = z.object({
  payrollPeriodId: z.string().min(1, 'Payroll Period is required'),
  branchId: z.string().min(1, 'Branch is required'),
  departmentId: z.string().optional(),
  sectionId: z.string().optional(),
  employmentType: z.string().optional(),
});

export type CalculatePayrollFormValues = z.infer<typeof calculatePayrollSchema>;

export const payrollApprovalSchema = z.object({
  level: z.enum(['HR', 'FINANCE', 'MANAGEMENT']),
  status: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().optional(),
});
