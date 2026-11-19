import { z } from 'zod';
import { POS_PAYMENT_METHODS } from './pos';

export const ECOMMERCE_CHANNEL_TYPES = [
  'SHOPIFY',
  'WOOCOMMERCE',
  'FACEBOOK',
  'DARAZ',
  'MANUAL',
  'OTHER',
] as const;

export const createChannelSchema = z.object({
  branchId: z.string().cuid(),
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(120),
  type: z.enum(ECOMMERCE_CHANNEL_TYPES).default('MANUAL'),
  storeUrl: z.string().trim().url().optional().or(z.literal('')),
});
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

const syncOrderItemSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  quantity: z.coerce.number().gt(0, 'Quantity must be > 0'),
  unitPrice: z.coerce.number().min(0),
  discountRate: z.coerce.number().min(0).max(100).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export const syncOrderSchema = z.object({
  branchId: z.string().cuid(),
  warehouseId: z.string().cuid().optional().or(z.literal('')),
  channelCode: z.string().trim().min(1).max(32),
  channelName: z.string().trim().min(1).max(120),
  channelType: z.enum(ECOMMERCE_CHANNEL_TYPES).default('MANUAL'),
  externalId: z.string().trim().min(1),
  orderDate: z.coerce.date().optional(),
  customerName: z.string().trim().max(120).optional().or(z.literal('')),
  customerPhone: z.string().trim().max(40).optional().or(z.literal('')),
  customerEmail: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  shipToAddress: z.string().trim().max(500).optional().or(z.literal('')),
  shippingTotal: z.coerce.number().min(0).default(0),
  paidTotal: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  items: z.array(syncOrderItemSchema).min(1, 'At least one line is required'),
});
export type SyncOrderFormInput = z.infer<typeof syncOrderSchema>;

export const packOrderSchema = z.object({
  orderId: z.string().cuid(),
});
export type PackOrderInput = z.infer<typeof packOrderSchema>;

export const fulfillOrderSchema = z.object({
  orderId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  courier: z.string().trim().max(80).optional().or(z.literal('')),
  trackingNo: z.string().trim().max(80).optional().or(z.literal('')),
  delivered: z.boolean().default(false),
});
export type FulfillOrderFormInput = z.infer<typeof fulfillOrderSchema>;

const returnOrderItemSchema = z.object({
  orderItemId: z.string().cuid(),
  quantity: z.coerce.number().gt(0),
});

export const returnOrderSchema = z.object({
  orderId: z.string().cuid(),
  refundMethod: z.enum(POS_PAYMENT_METHODS),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
  items: z.array(returnOrderItemSchema).min(1),
});
export type ReturnOrderFormInput = z.infer<typeof returnOrderSchema>;

const settlementSchema = z.object({
  externalOrderId: z.string().trim().min(1),
  amount: z.coerce.number().gt(0),
  fee: z.coerce.number().min(0).default(0),
  provider: z.string().trim().max(80).optional().or(z.literal('')),
  externalPaymentId: z.string().trim().max(120).optional().or(z.literal('')),
  receivedAt: z.coerce.date().optional(),
});

export const reconcilePaymentsSchema = z.object({
  branchId: z.string().cuid(),
  channelId: z.string().cuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  settlements: z.array(settlementSchema).min(1, 'At least one settlement is required'),
});
export type ReconcilePaymentsFormInput = z.infer<typeof reconcilePaymentsSchema>;
