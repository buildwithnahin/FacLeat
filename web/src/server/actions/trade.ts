'use server';

import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { apiOk, apiError, type ApiResponse } from '@/lib/api';
import {
  createTradeOrderSchema,
  updateTradeOrderStatusSchema,
  createShipmentSchema,
  updateShipmentStatusSchema,
  createLCSchema,
  updateLCStatusSchema,
  createLCAmendmentSchema,
  amendmentDecisionSchema,
  createLCDrawdownSchema,
  drawdownDecisionSchema,
  recordDrawdownPaymentSchema,
  createTradePaymentSchema,
} from '@/server/validators/trade';

/**
 * Thin POST wrapper shared by every trade mutation below — validates with the
 * same Zod schema the backend re-validates with (defense in depth / fast
 * client feedback), then forwards to backend/'s trade route. Mirrors the
 * `tradeService.<method>` call the old root action made directly.
 */
async function post<T>(path: string, data: unknown, successMessage: string): Promise<ApiResponse<T>> {
  try {
    const result = await backendFetch<T>(path, { method: 'POST', body: JSON.stringify(data) });
    return apiOk(result, successMessage);
  } catch (err) {
    if (err instanceof BackendApiError) return apiError(err.message, err.details);
    return apiError(err);
  }
}

export async function createTradeOrder(input: unknown) {
  const parsed = createTradeOrderSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string }>('/api/mobile/trade/orders', parsed.data, 'Trade order created');
}

export async function updateTradeOrderStatus(input: unknown) {
  const parsed = updateTradeOrderStatusSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string; status: string }>('/api/mobile/trade/orders/status', parsed.data, 'Status updated');
}

export async function createTradeShipment(input: unknown) {
  const parsed = createShipmentSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string }>('/api/mobile/trade/shipments', parsed.data, 'Shipment recorded');
}

export async function updateTradeShipmentStatus(input: unknown) {
  const parsed = updateShipmentStatusSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string; status: string }>(
    '/api/mobile/trade/shipments/status',
    parsed.data,
    'Shipment status updated',
  );
}

export async function createLetterOfCredit(input: unknown) {
  const parsed = createLCSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string }>('/api/mobile/trade/lc', parsed.data, 'Letter of Credit issued');
}

export async function updateLCStatus(input: unknown) {
  const parsed = updateLCStatusSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string; status: string }>('/api/mobile/trade/lc/status', parsed.data, 'LC status updated');
}

export async function createLCAmendment(input: unknown) {
  const parsed = createLCAmendmentSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string }>('/api/mobile/trade/lc/amendments', parsed.data, 'Amendment request submitted');
}

export async function decideLCAmendment(input: unknown) {
  const parsed = amendmentDecisionSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string }>(
    '/api/mobile/trade/lc/amendments/decision',
    parsed.data,
    `Amendment ${parsed.data.decision.toLowerCase()}`,
  );
}

export async function createLCDrawdown(input: unknown) {
  const parsed = createLCDrawdownSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string }>('/api/mobile/trade/lc/drawdowns', parsed.data, 'Drawdown presentation recorded');
}

export async function decideLCDrawdown(input: unknown) {
  const parsed = drawdownDecisionSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string }>(
    '/api/mobile/trade/lc/drawdowns/decision',
    parsed.data,
    `Drawdown ${parsed.data.decision.toLowerCase().replace('_', ' ')}`,
  );
}

export async function recordLCDrawdownPayment(input: unknown) {
  const parsed = recordDrawdownPaymentSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string }>('/api/mobile/trade/lc/drawdowns/payment', parsed.data, 'Payment recorded');
}

export async function createTradePaymentAction(input: unknown) {
  const parsed = createTradePaymentSchema.safeParse(input);
  if (!parsed.success) return apiError('Validation failed', parsed.error.flatten());
  return post<{ id: string }>('/api/mobile/trade/payments', parsed.data, 'Payment recorded');
}
