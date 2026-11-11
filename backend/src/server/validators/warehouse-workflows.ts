import { z } from 'zod';

const qty = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'string' ? v.trim() : String(v)))
  .refine((v) => /^\d+(\.\d+)?$/.test(v), { message: 'Must be a positive number' })
  .refine((v) => Number(v) > 0, { message: 'Must be greater than zero' });

const money = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'string' ? v.trim() : String(v)))
  .transform((v) => (v === '' ? '0' : v))
  .refine((v) => /^\d+(\.\d+)?$/.test(v), { message: 'Must be a non-negative number' });

const intakeItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: qty,
});

export const customerReturnIntakeSchema = z.object({
  branchId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  sourceDocumentType: z.string().trim().max(40).optional().or(z.literal('')),
  sourceDocumentNumber: z.string().trim().max(80).optional().or(z.literal('')),
  customerName: z.string().trim().max(120).optional().or(z.literal('')),
  customerPhone: z.string().trim().max(40).optional().or(z.literal('')),
  financeAction: z.enum(['NONE', 'REFUND', 'EXCHANGE', 'CREDIT_ADJUSTMENT']).default('NONE'),
  financeNote: z.string().trim().max(500).optional().or(z.literal('')),
  intakeNote: z.string().trim().max(500).optional().or(z.literal('')),
  items: z.array(intakeItemSchema).min(1),
});

export const customerReturnInspectionSchema = z.object({
  id: z.string().cuid(),
  financeAction: z.enum(['NONE', 'REFUND', 'EXCHANGE', 'CREDIT_ADJUSTMENT']).default('NONE'),
  financeNote: z.string().trim().max(500).optional().or(z.literal('')),
  inspectionNote: z.string().trim().max(500).optional().or(z.literal('')),
  items: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        disposition: z.enum(['RESTOCK', 'REWORK', 'DAMAGED', 'REJECT']),
        note: z.string().trim().max(500).optional().or(z.literal('')),
      }),
    )
    .min(1),
});

export const damageReportSchema = z.object({
  branchId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  reason: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: qty,
        costPerUnit: money.optional(),
      }),
    )
    .min(1),
});

export const damageResolutionSchema = z.object({
  id: z.string().cuid(),
  resolution: z.enum(['SCRAP', 'REPAIR', 'B_GRADE', 'SUPPLIER_CLAIM']),
  supplierId: z.string().cuid().optional().or(z.literal('')),
  grnId: z.string().cuid().optional().or(z.literal('')),
  purchaseInvoiceId: z.string().cuid().optional().or(z.literal('')),
  claimAmount: money.optional(),
  claimReference: z.string().trim().max(120).optional().or(z.literal('')),
  resolutionNote: z.string().trim().max(500).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.resolution !== 'SUPPLIER_CLAIM') return;
  if (!value.supplierId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['supplierId'],
      message: 'Supplier is required for supplier claim',
    });
  }
  const claimAmount = Number(value.claimAmount || '0');
  if (!(claimAmount > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['claimAmount'],
      message: 'Claim amount must be greater than zero',
    });
  }
});

export const damageRejectSchema = z.object({
  id: z.string().cuid(),
  resolutionNote: z.string().trim().max(500).optional().or(z.literal('')),
});

export type CustomerReturnIntakeInput = z.infer<typeof customerReturnIntakeSchema>;
export type CustomerReturnInspectionInput = z.infer<typeof customerReturnInspectionSchema>;
export type DamageReportInput = z.infer<typeof damageReportSchema>;
export type DamageResolutionInput = z.infer<typeof damageResolutionSchema>;
export type DamageRejectInput = z.infer<typeof damageRejectSchema>;
