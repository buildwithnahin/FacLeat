import { z } from 'zod';

export const OVERTIME_TYPES = [
  'REGULAR', 'HOLIDAY', 'WEEKEND', 'NIGHT', 'EMERGENCY', 'PRODUCTION',
] as const;

export const OVERTIME_SOURCES = [
  'ATTENDANCE_BASED', 'MANUAL_ENTRY', 'DEVICE_IMPORT',
] as const;

export const OVERTIME_RATE_TYPES = [
  'FIXED_RATE', 'BASIC_SALARY_BASED', 'GROSS_SALARY_BASED', 'MANUAL_RATE',
] as const;

export const OVERTIME_STATUSES = [
  'DRAFT', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_ACCOUNTS',
  'APPROVED', 'POSTED_TO_PAYROLL', 'REJECTED', 'CANCELLED',
] as const;

export const OVERTIME_TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Regular Overtime',
  HOLIDAY: 'Holiday Overtime',
  WEEKEND: 'Weekend Overtime',
  NIGHT: 'Night Overtime',
  EMERGENCY: 'Emergency Overtime',
  PRODUCTION: 'Production Overtime',
};

export const OVERTIME_SOURCE_LABELS: Record<string, string> = {
  ATTENDANCE_BASED: 'Attendance Based',
  MANUAL_ENTRY: 'Manual Entry',
  DEVICE_IMPORT: 'Imported From Device',
};

export const OVERTIME_RATE_TYPE_LABELS: Record<string, string> = {
  FIXED_RATE: 'Fixed Rate',
  BASIC_SALARY_BASED: 'Basic Salary Based',
  GROSS_SALARY_BASED: 'Gross Salary Based',
  MANUAL_RATE: 'Manual Rate',
};

export const OVERTIME_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_MANAGER: 'Pending Manager',
  PENDING_HR: 'Pending HR',
  PENDING_ACCOUNTS: 'Pending Accounts',
  APPROVED: 'Approved',
  POSTED_TO_PAYROLL: 'Posted to Payroll',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

// Generate OT from attendance
export const overtimeGenerateSchema = z.object({
  date: z.coerce.date(),
  branchId: z.string().cuid(),
  department: z.string().trim().optional().or(z.literal('')),
  shiftId: z.string().cuid().optional().or(z.literal('')),
  employeeId: z.string().cuid().optional().or(z.literal('')),
  otType: z.enum(OVERTIME_TYPES).default('REGULAR'),
  otRateType: z.enum(OVERTIME_RATE_TYPES).default('FIXED_RATE'),
  otRatePerHour: z.coerce.number().min(0).default(0),
});

// Manual single OT create
export const overtimeCreateSchema = z.object({
  branchId: z.string().cuid(),
  employeeId: z.string().cuid(),
  otDate: z.coerce.date(),
  otType: z.enum(OVERTIME_TYPES),
  source: z.enum(OVERTIME_SOURCES).default('MANUAL_ENTRY'),
  otRateType: z.enum(OVERTIME_RATE_TYPES).default('FIXED_RATE'),
  otRatePerHour: z.coerce.number().min(0).default(0),
  approvedOtMinutes: z.coerce.number().min(0),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
});

// Manager approval
export const overtimeManagerApprovalSchema = z.object({
  id: z.string().cuid(),
  decision: z.enum(['APPROVED', 'REJECTED', 'SENT_BACK']),
  approvedOtMinutes: z.coerce.number().min(0).optional(),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
});

// HR verification
export const overtimeHrVerificationSchema = z.object({
  id: z.string().cuid(),
  decision: z.enum(['VERIFIED', 'REJECTED', 'SENT_BACK']),
  verifiedMinutes: z.coerce.number().min(0).optional(),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
});

// Accounts approval
export const overtimeAccountsApprovalSchema = z.object({
  id: z.string().cuid(),
  decision: z.enum(['APPROVED', 'REJECTED', 'CORRECTION_REQUESTED']),
  otRate: z.coerce.number().min(0).optional(),
  payrollMonth: z.string().trim().optional().or(z.literal('')),
  costCenter: z.string().trim().optional().or(z.literal('')),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
});

// Submit to next step
export const overtimeSubmitSchema = z.object({
  id: z.string().cuid(),
});

// Post to payroll
export const overtimePostToPayrollSchema = z.object({
  id: z.string().cuid(),
});

// Cancel
export const overtimeCancelSchema = z.object({
  id: z.string().cuid(),
});

export type OvertimeGenerateInput = z.infer<typeof overtimeGenerateSchema>;
export type OvertimeCreateInput = z.infer<typeof overtimeCreateSchema>;
export type OvertimeManagerApprovalInput = z.infer<typeof overtimeManagerApprovalSchema>;
export type OvertimeHrVerificationInput = z.infer<typeof overtimeHrVerificationSchema>;
export type OvertimeAccountsApprovalInput = z.infer<typeof overtimeAccountsApprovalSchema>;
