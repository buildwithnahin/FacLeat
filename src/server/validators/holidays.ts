import { z } from 'zod';

export const HOLIDAY_TYPES = [
  'GOVERNMENT_HOLIDAY',
  'COMPANY_HOLIDAY',
  'RELIGIOUS_HOLIDAY',
  'FESTIVAL_HOLIDAY',
  'WEEKLY_HOLIDAY',
  'SPECIAL_HOLIDAY',
] as const;

export const HOLIDAY_STATUSES = ['ACTIVE', 'INACTIVE', 'DRAFT'] as const;

const holidayFields = {
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(64).optional().or(z.literal('')),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  type: z.enum(HOLIDAY_TYPES),
  branchId: z.string().cuid().optional().or(z.literal('')),
  isPaid: z.boolean().default(true),
  status: z.enum(HOLIDAY_STATUSES).default('ACTIVE'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
} as const;

export const holidayCreateSchema = z.object(holidayFields).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  }
);

export const holidayUpdateSchema = z.object({
  id: z.string().cuid(),
  ...holidayFields,
}).refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  }
);

export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;
export type HolidayUpdateInput = z.infer<typeof holidayUpdateSchema>;
