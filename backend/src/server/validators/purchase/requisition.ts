import { z } from 'zod';
import { UNITS, PRIORITY } from './shared';

export const requisitionItemSchema = z.object({
  productId: z.string().cuid().optional().or(z.literal('')),
  productName: z.string().trim().min(1, 'Product name required').max(120),
  unit: z.enum(UNITS).default('PCS'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  estimatedPrice: z.coerce.number().min(0).default(0),
  note: z.string().trim().max(240).optional().or(z.literal('')),
});

export const requisitionCreateSchema = z.object({
  branchId: z.string().cuid('Select a branch'),
  department: z.string().trim().min(1, 'Department required').max(80),
  requestedBy: z.string().trim().min(1, 'Requested by required').max(120),
  priority: z.enum(PRIORITY).default('MEDIUM'),
  requiredDate: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  items: z.array(requisitionItemSchema).min(1, 'Add at least one item'),
});

export type RequisitionCreateInput = z.infer<typeof requisitionCreateSchema>;

export const requisitionDecisionSchema = z.object({
  id: z.string().cuid(),
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
});
export type RequisitionDecisionInput = z.infer<typeof requisitionDecisionSchema>;
