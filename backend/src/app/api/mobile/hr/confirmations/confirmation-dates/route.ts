import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { prisma } from '@/server/db';

/**
 * Employee -> most-recent-confirmation-date lookup, used by the resignation
 * form's read-only employee panel ("Confirmation Date" field). Kept as its
 * own tiny endpoint rather than folding into `confirmationsService.list`
 * since it's a distinct-per-employee reduction, not a paged record list.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const branchId = req.nextUrl.searchParams.get('branchId') ?? undefined;
    const rows = await prisma.employeeConfirmation.findMany({
      where: {
        employee: branchId ? { branchId } : undefined,
        status: 'CONFIRMED',
      },
      orderBy: [{ confirmedAt: 'desc' }],
      select: { employeeId: true, confirmedAt: true },
    });

    const map: Record<string, string> = {};
    for (const row of rows) {
      if (!row.confirmedAt || map[row.employeeId]) continue;
      map[row.employeeId] = row.confirmedAt.toISOString().slice(0, 10);
    }
    return Response.json(apiOk(map));
  } catch (err) {
    // Confirmation table may not be migrated yet — degrade gracefully like the page used to.
    console.error('GET /api/mobile/hr/confirmations/confirmation-dates failed', err);
    return Response.json(apiOk({}));
  }
}
