import { z } from 'zod';

export const userCreateSchema = z.object({
  employeeId: z.string().cuid('Employee is required'),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Minimum 8 characters').max(128),
  defaultBranchId: z.string().cuid().optional().or(z.literal('')),
  roleId: z.string().cuid('Role is required'),
  status: z.enum(['ACTIVE', 'DISABLED', 'PENDING']).default('ACTIVE'),
});

export const userUpdateSchema = z.object({
  id: z.string().cuid(),
  employeeId: z.string().cuid('Employee is required'),
  email: z.string().trim().toLowerCase().email(),
  /// blank → keep existing
  password: z.string().min(8).max(128).optional().or(z.literal('')),
  defaultBranchId: z.string().cuid().optional().or(z.literal('')),
  roleId: z.string().cuid('Role is required'),
  status: z.enum(['ACTIVE', 'DISABLED', 'PENDING']),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
