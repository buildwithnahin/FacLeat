import { z } from 'zod';

export const calculateSettlementSchema = z.object({
  resignationId: z.string().min(1, 'Resignation record is required'),
});

export const approvalSettlementSchema = z.object({
  level: z.enum(['HR', 'FINANCE', 'MANAGEMENT']),
  status: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().optional(),
});

export const paymentSettlementSchema = z.object({
  paymentMethod: z.string().min(1, 'Payment Method is required'),
  paymentDate: z.string().min(1, 'Payment Date is required'),
  transactionRef: z.string().optional(),
});
