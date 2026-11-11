import { z } from 'zod';

export const companyCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(16)
    .regex(/^[A-Z0-9_-]+$/, 'Only A–Z, 0–9, _ or -'),
  name: z.string().trim().min(1).max(120),
  currency: z.enum(['BDT', 'INR', 'USD', 'EUR']).default('BDT'),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

export const companyUpdateSchema = companyCreateSchema.extend({
  id: z.string().cuid(),
});

export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
