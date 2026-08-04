import { z } from 'zod';

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
    audienceType: z.enum(['ALL', 'BRANCH', 'DEPARTMENT', 'USER']),
    audienceBranchId: z.string().optional(),
    audienceDepartment: z.string().trim().optional(),
    audienceUserId: z.string().optional(),
    documentIds: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.audienceType === 'BRANCH' && !data.audienceBranchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audienceBranchId'],
        message: 'Branch is required for branch-targeted announcements',
      });
    }
    if (data.audienceType === 'DEPARTMENT' && !data.audienceDepartment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audienceDepartment'],
        message: 'Department is required for department-targeted announcements',
      });
    }
    if (data.audienceType === 'USER' && !data.audienceUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audienceUserId'],
        message: 'User is required for user-targeted announcements',
      });
    }
  });

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
