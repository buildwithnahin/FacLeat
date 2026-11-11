import { z } from 'zod';

const qty = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === 'string' ? value.trim() : String(value)))
  .refine((value) => /^\d+(\.\d+)?$/.test(value), { message: 'Must be a non-negative number' });

const positiveQty = qty.refine((value) => Number(value) > 0, {
  message: 'Must be greater than zero',
});

const note = z.string().trim().max(500).optional().or(z.literal(''));

export const stockRequisitionItemSchema = z.object({
  productId: z.string().cuid(),
  unit: z.enum(['PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET']),
  requestedQty: positiveQty,
  note,
});

export const stockRequisitionCreateSchema = z.object({
  branchId: z.string().cuid(),
  showroomWarehouseId: z.string().cuid(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  requiredDate: z.coerce.date(),
  remarks: note,
  items: z.array(stockRequisitionItemSchema).min(1),
});

export const stockRequisitionDecisionSchema = z.object({
  requisitionId: z.string().cuid(),
  decision: z.enum(['APPROVE', 'REJECT']),
  sourceWarehouseId: z.string().cuid().optional().or(z.literal('')),
  approvalNote: note,
  rejectionReason: note,
  items: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        approvedQty: qty,
      }),
    )
    .min(1),
});

export const stockRequisitionAssignSchema = z.object({
  requisitionId: z.string().cuid(),
  sourceWarehouseId: z.string().cuid(),
});

export const stockDispatchCreateSchema = z.object({
  requisitionId: z.string().cuid(),
  expectedDate: z.coerce.date().optional(),
  packedBy: z.string().trim().max(120).optional().or(z.literal('')),
  vehicle: z.string().trim().max(120).optional().or(z.literal('')),
  driverName: z.string().trim().max(120).optional().or(z.literal('')),
  driverPhone: z.string().trim().max(60).optional().or(z.literal('')),
  gatePassNo: z.string().trim().max(80).optional().or(z.literal('')),
  trackingNo: z.string().trim().max(80).optional().or(z.literal('')),
  remarks: note,
  items: z
    .array(
      z.object({
        requisitionItemId: z.string().cuid(),
        productId: z.string().cuid(),
        quantity: positiveQty,
        note,
      }),
    )
    .min(1),
});

export const stockTransferStatusSchema = z.object({
  transferId: z.string().cuid(),
  status: z.enum(['PACKED', 'DISPATCHED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']),
  dispatchNote: note,
});

export const stockTransferReceiveSchema = z.object({
  transferId: z.string().cuid(),
  receiveRemarks: note,
  items: z
    .array(
      z.object({
        itemId: z.string().cuid(),
        receivedQty: qty,
        damagedQty: qty,
        missingQty: qty,
      }),
    )
    .min(1),
});

export type StockRequisitionCreateInput = z.infer<typeof stockRequisitionCreateSchema>;
export type StockRequisitionDecisionInput = z.infer<typeof stockRequisitionDecisionSchema>;
export type StockRequisitionAssignInput = z.infer<typeof stockRequisitionAssignSchema>;
export type StockDispatchCreateInput = z.infer<typeof stockDispatchCreateSchema>;
export type StockTransferStatusInput = z.infer<typeof stockTransferStatusSchema>;
export type StockTransferReceiveInput = z.infer<typeof stockTransferReceiveSchema>;
