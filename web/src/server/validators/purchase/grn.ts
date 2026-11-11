import { z } from 'zod';

export const grnItemSchema = z.object({
  purchaseOrderItemId: z.string().cuid(),
  productId: z.string().cuid(),
  size: z.string().trim().max(32).optional().or(z.literal('')),
  receivedQty: z.coerce.number().min(0),
  rejectedQty: z.coerce.number().min(0).default(0),
  unitCost: z.coerce.number().min(0),
  note: z.string().trim().max(240).optional().or(z.literal('')),
});

export const grnCreateSchema = z.object({
  purchaseOrderId: z.string().cuid('Select a purchase order'),
  warehouseId: z.string().cuid('Select a warehouse'),
  receivedDate: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  items: z
    .array(grnItemSchema)
    .min(1, 'At least one line must be received'),
});
export type GrnCreateInput = z.infer<typeof grnCreateSchema>;
