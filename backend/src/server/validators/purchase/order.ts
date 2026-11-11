import { z } from 'zod';
import { UNITS, PURCHASE_ACCOUNT_CATEGORIES } from './shared';

export const poItemSchema = z.object({
  productId: z.string().cuid('Select a product'),
  accountCategory: z.enum(PURCHASE_ACCOUNT_CATEGORIES).default('INVENTORY'),
  size: z.string().trim().max(32).optional().or(z.literal('')),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  unit: z.enum(UNITS).default('PCS'),
  orderedQty: z.coerce.number().positive('Quantity must be greater than zero'),
  unitPrice: z.coerce.number().min(0, 'Price must be zero or greater'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discountRate: z.coerce.number().min(0).max(100).default(0),
});

export const poCreateSchema = z.object({
  branchId: z.string().cuid('Select a branch'),
  supplierId: z.string().cuid('Select a supplier'),
  requisitionId: z.string().cuid().optional().or(z.literal('')),
  deliveryDate: z.coerce.date(),
  orderDate: z.coerce.date().optional(),
  currency: z.enum(['BDT', 'INR', 'USD', 'EUR']).default('BDT'),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  items: z.array(poItemSchema).min(1, 'Add at least one line item'),
});
export type PurchaseOrderCreateInput = z.infer<typeof poCreateSchema>;

export const poApproveSchema = z.object({
  id: z.string().cuid(),
});
