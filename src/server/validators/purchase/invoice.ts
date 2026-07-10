import { z } from 'zod';
import { UNITS } from './shared';

export const invoiceItemSchema = z.object({
  productId: z.string().cuid(),
  size: z.string().trim().max(32).optional().or(z.literal('')),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  unit: z.enum(UNITS).default('PCS'),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export const invoiceCreateSchema = z.object({
  branchId: z.string().cuid(),
  supplierId: z.string().cuid(),
  purchaseOrderId: z.string().cuid().optional().or(z.literal('')),
  grnId: z.string().cuid().optional().or(z.literal('')),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  currency: z.enum(['BDT', 'INR', 'USD', 'EUR']).default('BDT'),
  discountTotal: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one line item'),
});
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
