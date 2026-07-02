import { z } from 'zod';

export const EMPLOYMENT_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'] as const;
export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'HALF_DAY',
  'ON_LEAVE',
  'HOLIDAY',
  'WEEKEND',
  'OFFICIAL_DUTY',
] as const;
export const LEAVE_TYPES = [
  'CASUAL',
  'SICK',
  'EARNED',
  'ANNUAL',
  'MATERNITY',
  'PATERNITY',
  'EMERGENCY',
  'UNPAID',
  'COMPENSATORY',
  'SPECIAL',
  'FESTIVAL',
  'OTHER',
] as const;
export const LEAVE_STATUSES = [
  'DRAFT',
  'PENDING_MANAGER',
  'PENDING_HR',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'WITHDRAWN',
] as const;
export const DEFAULT_DEPARTMENTS = ['HR', 'Accounts', 'Production'] as const;
export const DEFAULT_DESIGNATIONS = ['HR Manager', 'Accountant', 'Factory Manager'] as const;
export const DEFAULT_EMPLOYMENT_TYPES = ['PERMANENT', 'PROBATION', 'CONTRACT', 'TEMPORARY', 'INTERN'] as const;
export const ERP_ROLE_NAMES = [
  'Super Admin',
  'Admin',
  'HR',
  'Accounts',
  'Commercial',
  'Inventory',
  'Production',
  'Purchase',
  'Store',
  'Sales',
  'Management',
] as const;

export const employeeCreateSchema = z.object({
  branchId: z.string().cuid(),
  code: z.string().trim().min(1).max(32).regex(/^[A-Z0-9._-]+$/i, 'Use letters, digits, dot, dash, underscore'),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
  designation: z.string().trim().max(80).optional().or(z.literal('')),
  department: z.string().trim().max(80).optional().or(z.literal('')),
  employmentType: z.string().trim().max(80).optional().or(z.literal('')),
  shiftId: z.string().cuid().optional().or(z.literal('')),
  reportingManagerId: z.string().cuid().optional().or(z.literal('')),
  systemRoleId: z.string().cuid().optional().or(z.literal('')),
  joinedAt: z.coerce.date(),
  status: z.enum(EMPLOYMENT_STATUSES).default('ACTIVE'),
  basicSalary: z.coerce.number().finite().min(0).default(0),
  houseAllowance: z.coerce.number().finite().min(0).default(0),
  transportAllowance: z.coerce.number().finite().min(0).default(0),
  medicalAllowance: z.coerce.number().finite().min(0).default(0),
  otherAllowance: z.coerce.number().finite().min(0).default(0),
  providentFund: z.coerce.number().finite().min(0).default(0),
  taxDeduction: z.coerce.number().finite().min(0).default(0),
  bankName: z.string().trim().max(80).optional().or(z.literal('')),
  bankAccount: z.string().trim().max(64).optional().or(z.literal('')),
});

export const employeeUpdateSchema = employeeCreateSchema.extend({ id: z.string().cuid() });

export const attendanceMarkSchema = z.object({
  employeeId: z.string().cuid(),
  date: z.coerce.date(),
  status: z.enum(ATTENDANCE_STATUSES),
  checkIn: z.string().optional().or(z.literal('')),
  checkOut: z.string().optional().or(z.literal('')),
  remarks: z.string().trim().max(200).optional().or(z.literal('')),
});

export const leaveCreateSchema = z
  .object({
    employeeId: z.string().cuid(),
    type: z.enum(LEAVE_TYPES),
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    reason: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((v) => v.toDate >= v.fromDate, { message: 'To date must be on/after from date' });

export const leaveDecisionSchema = z.object({
  id: z.string().cuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export const payrollRunCreateSchema = z.object({
  branchId: z.string().cuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const payrollRunActionSchema = z.object({
  id: z.string().cuid(),
});

export const hrMasterDataCreateSchema = z.object({
  type: z.string().trim().min(1).max(80),
  branchId: z.string().cuid().optional().or(z.literal('')),
  code: z.string().trim().max(32).optional().or(z.literal('')),
  name: z.string().trim().min(1).max(120),
  department: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  status: z.string().trim().min(1).max(40).default('ACTIVE'),
});

export const hrMasterDataUpdateSchema = hrMasterDataCreateSchema.extend({
  id: z.string().cuid(),
});

const hrWorkflowRecordFields = {
  section: z.string().trim().min(1).max(80),
  branchId: z.string().cuid().optional().or(z.literal('')),
  employeeId: z.string().cuid().optional().or(z.literal('')),
  title: z.string().trim().min(1).max(160),
  subject: z.string().trim().max(160).optional().or(z.literal('')),
  status: z.string().trim().min(1).max(40).default('OPEN'),
  priority: z.string().trim().min(1).max(40).default('NORMAL'),
  startDate: z.coerce.date().optional().or(z.literal('')),
  endDate: z.coerce.date().optional().or(z.literal('')),
  amount: z.coerce.number().finite().min(0).optional().or(z.literal('')),
  owner: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
} as const;

export const hrWorkflowRecordCreateSchema = z
  .object(hrWorkflowRecordFields)
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'End date must be on/after start date',
    path: ['endDate'],
  });

export const hrWorkflowRecordUpdateSchema = z
  .object({
    id: z.string().cuid(),
    ...hrWorkflowRecordFields,
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'End date must be on/after start date',
    path: ['endDate'],
  });

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type AttendanceMarkInput = z.infer<typeof attendanceMarkSchema>;
export type LeaveCreateInput = z.infer<typeof leaveCreateSchema>;
export type LeaveDecisionInput = z.infer<typeof leaveDecisionSchema>;
export type PayrollRunCreateInput = z.infer<typeof payrollRunCreateSchema>;
export type HrMasterDataCreateInput = z.infer<typeof hrMasterDataCreateSchema>;
export type HrMasterDataUpdateInput = z.infer<typeof hrMasterDataUpdateSchema>;
export type HrWorkflowRecordCreateInput = z.infer<typeof hrWorkflowRecordCreateSchema>;
export type HrWorkflowRecordUpdateInput = z.infer<typeof hrWorkflowRecordUpdateSchema>;
