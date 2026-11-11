import { z } from 'zod';

export const debitNoteItemSchema = z.object({
  productId: z.string().cuid('Select a product'),
  returnedQty: z.coerce.number().positive('Quantity must be greater than zero'),
  unitPrice: z.coerce.number().min(0),
  reason: z.string().trim().max(240).optional().or(z.literal('')),
  condition: z.string().trim().max(80).optional().or(z.literal('')),
});

export const debitNoteCreateSchema = z.object({
  branchId: z.string().cuid('Select a branch'),
  supplierId: z.string().cuid('Select a supplier'),
  warehouseId: z.string().cuid('Select a warehouse'),
  invoiceId: z.string().cuid().optional().or(z.literal('')),
  grnId: z.string().cuid().optional().or(z.literal('')),
  returnDate: z.coerce.date(),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
  vatAdjustment: z.coerce.number().min(0).default(0),
  items: z.array(debitNoteItemSchema).min(1, 'Add at least one line item'),
});
export type DebitNoteCreateInput = z.infer<typeof debitNoteCreateSchema>;
