import { z } from 'zod';

const branchAccessTypes = ['ALL_BRANCHES', 'ASSIGNED_BRANCHES', 'OWN_BRANCH_ONLY'] as const;

const branchAccessFields = {
  defaultBranchId: z.string().cuid().optional().or(z.literal('')),
  branchAccessType: z.enum(branchAccessTypes).default('OWN_BRANCH_ONLY'),
  assignedBranchIds: z.array(z.string().cuid()).default([]),
};

export const userCreateSchema = z.object({
  employeeId: z.string().cuid('Employee is required'),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Minimum 8 characters').max(128),
  roleId: z.string().cuid('Role is required'),
  status: z.enum(['ACTIVE', 'DISABLED', 'PENDING']).default('ACTIVE'),
}).extend(branchAccessFields).superRefine((data, ctx) => {
  if (data.branchAccessType === 'OWN_BRANCH_ONLY' && !data.defaultBranchId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['defaultBranchId'],
      message: 'Default branch is required for own-branch users',
    });
  }

  if (data.branchAccessType === 'ASSIGNED_BRANCHES') {
    if (data.assignedBranchIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assignedBranchIds'],
        message: 'Select at least one branch',
      });
    }
    if (data.defaultBranchId && !data.assignedBranchIds.includes(data.defaultBranchId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultBranchId'],
        message: 'Default branch must be one of the assigned branches',
      });
    }
  }
});

export const userUpdateSchema = z.object({
  id: z.string().cuid(),
  employeeId: z.string().cuid('Employee is required'),
  email: z.string().trim().toLowerCase().email(),
  /// blank → keep existing
  password: z.string().min(8).max(128).optional().or(z.literal('')),
  roleId: z.string().cuid('Role is required'),
  status: z.enum(['ACTIVE', 'DISABLED', 'PENDING']),
}).extend(branchAccessFields).superRefine((data, ctx) => {
  if (data.branchAccessType === 'OWN_BRANCH_ONLY' && !data.defaultBranchId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['defaultBranchId'],
      message: 'Default branch is required for own-branch users',
    });
  }

  if (data.branchAccessType === 'ASSIGNED_BRANCHES') {
    if (data.assignedBranchIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assignedBranchIds'],
        message: 'Select at least one branch',
      });
    }
    if (data.defaultBranchId && !data.assignedBranchIds.includes(data.defaultBranchId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultBranchId'],
        message: 'Default branch must be one of the assigned branches',
      });
    }
  }
});

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Minimum 8 characters').max(128),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;
