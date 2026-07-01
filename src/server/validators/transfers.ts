import { z } from 'zod';

export const TRANSFER_TYPES = ['BRANCH', 'DEPARTMENT', 'SHIFT', 'TEMPORARY', 'PERMANENT'] as const;
export const TRANSFER_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
] as const;

export const TRANSFER_TYPE_LABELS: Record<string, string> = {
  BRANCH: 'Branch Transfer',
  DEPARTMENT: 'Department Transfer',
  SHIFT: 'Shift Transfer',
  TEMPORARY: 'Temporary Transfer',
  PERMANENT: 'Permanent Transfer',
};

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const baseTransferFields = {
  branchId: z.string().cuid(),
  employeeId: z.string().cuid(),
  transferType: z.enum(TRANSFER_TYPES),
  reason: z.string().trim().min(1, 'Transfer reason is required').max(1000),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
  newReportingManagerId: z.string().cuid().optional().or(z.literal('')),

  // Branch Transfer
  newBranchId: z.string().cuid().optional().or(z.literal('')),

  // Department Transfer
  newDepartment: z.string().trim().max(80).optional().or(z.literal('')),

  // Shift Transfer
  newShiftId: z.string().cuid().optional().or(z.literal('')),

  // Temporary Transfer
  tempBranchId: z.string().cuid().optional().or(z.literal('')),
  tempDepartment: z.string().trim().max(80).optional().or(z.literal('')),
  tempShiftId: z.string().cuid().optional().or(z.literal('')),
  startDate: z.coerce.date().optional().or(z.literal('')),
  endDate: z.coerce.date().optional().or(z.literal('')),

  // Effective date (non-temp transfers)
  effectiveDate: z.coerce.date().optional().or(z.literal('')),
} satisfies z.ZodRawShape;

function withTransferRules<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((value, ctx) => {
    const type = value.transferType;

    // Branch Transfer requires new branch
    if (type === 'BRANCH' && !value.newBranchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newBranchId'],
        message: 'New branch is required for branch transfer',
      });
    }
    if (type === 'BRANCH' && !value.effectiveDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveDate'],
        message: 'Effective date is required',
      });
    }

    // Department Transfer requires new department
    if (type === 'DEPARTMENT' && !value.newDepartment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newDepartment'],
        message: 'New department is required for department transfer',
      });
    }
    if (type === 'DEPARTMENT' && !value.effectiveDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveDate'],
        message: 'Effective date is required',
      });
    }

    // Shift Transfer requires new shift
    if (type === 'SHIFT' && !value.newShiftId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newShiftId'],
        message: 'New shift is required for shift transfer',
      });
    }
    if (type === 'SHIFT' && !value.effectiveDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveDate'],
        message: 'Effective date is required',
      });
    }

    // Temporary Transfer requires start and end dates
    if (type === 'TEMPORARY') {
      if (!value.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startDate'],
          message: 'Start date is required for temporary transfer',
        });
      }
      if (!value.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'End date is required for temporary transfer',
        });
      }
      if (
        value.startDate instanceof Date &&
        value.endDate instanceof Date &&
        value.endDate < value.startDate
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'End date must be on or after start date',
        });
      }
      // At least one temp destination is required
      if (!value.tempBranchId && !value.tempDepartment && !value.tempShiftId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tempBranchId'],
          message: 'At least one temporary destination (branch, department, or shift) is required',
        });
      }
    }

    // Permanent Transfer requires effective date
    if (type === 'PERMANENT') {
      if (!value.effectiveDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effectiveDate'],
          message: 'Effective date is required for permanent transfer',
        });
      }
      // At least one destination change is required
      if (!value.newBranchId && !value.newDepartment && !value.newShiftId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['newBranchId'],
          message: 'At least one destination (branch, department, or shift) is required',
        });
      }
    }
  });
}

export const transferCreateSchema = withTransferRules(baseTransferFields);
export const transferUpdateSchema = withTransferRules({
  ...baseTransferFields,
  id: z.string().cuid(),
});

export const transferStatusActionSchema = z.object({
  id: z.string().cuid(),
  action: z.enum(['submit', 'approve', 'reject', 'complete', 'cancel']),
  rejectionReason: z.string().trim().max(500).optional().or(z.literal('')),
});

export type TransferCreateInput = z.infer<typeof transferCreateSchema>;
export type TransferUpdateInput = z.infer<typeof transferUpdateSchema>;
export type TransferStatusActionInput = z.infer<typeof transferStatusActionSchema>;
