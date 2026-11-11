import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { purchaseService } from '@/server/services/purchase.service';
import { ApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

const OPEN_STATUSES = ['PENDING', 'PARTIALLY_PAID'];

/**
 * Backs the "apply to invoice" picker on the supplier payment form —
 * originally a raw `prisma.purchaseInvoice.findMany` in the page component.
 * Reuses `purchaseService.listInvoices` (supplier-scoped) and filters to
 * open statuses here rather than widening that service's filter signature.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;

  try {
    const invoices = await purchaseService.listInvoices(session, { supplierId: id });
    const open = invoices
      .filter((inv) => OPEN_STATUSES.includes(inv.status))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return Response.json(apiOk(open));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/suppliers/[id]/open-invoices failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
