import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { posService } from '@/server/services/pos.service';
import { prisma } from '@/server/db';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Raw sale + branch data for the Mushak 6.3 print view. The VAT-breakdown
 * computation itself (computeMushak63) stays client-side in web/'s
 * lib/mushak63.ts — it's a pure function, no reason to round-trip it.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const sale = await posService.getSale(session, id);
    const branch = await prisma.branch.findUnique({
      where: { id: sale.branchId },
      select: { name: true, address: true, phone: true, email: true, vatNumber: true },
    });
    return Response.json(apiOk({ sale, branch }));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`GET /api/mobile/pos/sales/${id}/mushak63 failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
