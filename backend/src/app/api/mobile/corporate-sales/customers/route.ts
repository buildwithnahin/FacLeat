import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { authorize } from '@/server/auth/authorize';
import { assertBranchInScope } from '@/server/auth/data-scope';
import { prisma } from '@/server/db';

/**
 * Scoped to corporate-sales — the quote/order builder pages need an
 * active-customer picker for the current branch. Not the general CRM
 * customer listing endpoint (that belongs to the crm module).
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId') ?? session.activeBranchId;
  if (!branchId) return Response.json(apiOk([]));

  try {
    await authorize(session, 'corporate-sales:read');
    await assertBranchInScope(session, branchId);
    const customers = await prisma.customer.findMany({
      where: { branchId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, code: true, name: true, type: true, creditLimit: true, currency: true },
    });
    return Response.json(apiOk(customers));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/corporate-sales/customers failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
