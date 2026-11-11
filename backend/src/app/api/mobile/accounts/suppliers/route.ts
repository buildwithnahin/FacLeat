import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { supplierService } from '@/server/services/supplier.service';

/**
 * Suppliers-as-contacts for the "Cash out" voucher form — mirrors root's
 * `listSuppliersAction`, which reaches into the Supplier Management module's
 * service (read-only import, no changes to that service) to give the cash
 * disbursement form the same contact-style picker cash-in uses for customers.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? session.activeBranchId ?? '';
  if (!branchId) return Response.json(apiOk([]));

  try {
    const suppliers = await supplierService.list(session, { branchId, status: 'ACTIVE' });
    return Response.json(
      apiOk(suppliers.map((s) => ({ id: s.id, name: s.name, type: 'SUPPLIER', code: s.code }))),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/accounts/suppliers failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
