import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { reportsService } from '@/server/services/reports.service';
import type { AppSession } from '@/server/auth/session';

type RouteParams = { params: Promise<{ type: string }> };

/** Kebab-case URL segment -> reportsService method name. */
const GENERAL_REPORT_MAP: Record<string, keyof typeof reportsService> = {
  'sales-summary': 'salesSummary',
  'top-products': 'topProducts',
  'purchase-summary': 'purchaseSummary',
  'inventory-valuation': 'inventoryValuation',
  'hr-summary': 'hrSummary',
  'dashboard-kpis': 'dashboardKpis',
  'cash-flow': 'cashFlow',
  'production-summary': 'productionSummary',
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { type } = await params;
  const methodName = GENERAL_REPORT_MAP[type];
  if (!methodName) {
    return Response.json(apiError('Unknown report type'), { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const branchId = sp.get('branchId') ?? undefined;
  const fromParam = sp.get('from');
  const toParam = sp.get('to');
  const limitParam = sp.get('limit');
  const filters = {
    branchId,
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
    limit: limitParam ? Number(limitParam) : undefined,
  };

  try {
    // Call through the service object (not a detached reference) so any
    // internal `this.someOtherMethod(...)` calls (e.g. dashboardKpis) stay
    // bound correctly.
    const fn = reportsService[methodName] as (
      session: AppSession | null,
      f: typeof filters,
    ) => Promise<unknown>;
    const data = await fn.call(reportsService, session, filters);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`GET /api/mobile/reports/general/${type} failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
