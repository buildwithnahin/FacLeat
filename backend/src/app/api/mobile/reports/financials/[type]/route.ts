import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { accountsService } from '@/server/services/accounts.service';
import type { AppSession } from '@/server/auth/session';

type RouteParams = { params: Promise<{ type: string }> };

type FinancialReportMode = 'asOf' | 'range';

/** Kebab-case URL segment -> accountsService method name + filter shape. */
const FINANCIAL_REPORT_MAP: Record<
  string,
  { method: keyof typeof accountsService; mode: FinancialReportMode }
> = {
  'trial-balance': { method: 'trialBalance', mode: 'asOf' },
  'balance-sheet': { method: 'balanceSheet', mode: 'asOf' },
  'income-statement': { method: 'incomeStatement', mode: 'range' },
  'cash-flow-statement': { method: 'cashFlowStatement', mode: 'range' },
  'changes-in-equity': { method: 'changesInEquity', mode: 'range' },
  notes: { method: 'financialNotes', mode: 'asOf' },
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { type } = await params;
  const entry = FINANCIAL_REPORT_MAP[type];
  if (!entry) {
    return Response.json(apiError('Unknown report type'), { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const branchId = sp.get('branchId') ?? undefined;
  const asOfParam = sp.get('asOf');
  const fromParam = sp.get('from');
  const toParam = sp.get('to');

  // `cashFlowStatement` / `changesInEquity` / `financialNotes` require a
  // non-optional Date on their filter type, so default when the caller
  // omits it instead of letting the service throw on `undefined.getTime()`.
  const filters =
    entry.mode === 'asOf'
      ? { branchId, asOf: asOfParam ? new Date(asOfParam) : new Date() }
      : {
          branchId,
          from: fromParam ? new Date(fromParam) : new Date(new Date().getFullYear(), 0, 1),
          to: toParam ? new Date(toParam) : new Date(),
        };

  try {
    const fn = accountsService[entry.method] as (
      session: AppSession | null,
      f: typeof filters,
    ) => Promise<unknown>;
    const data = await fn.call(accountsService, session, filters);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error(`GET /api/mobile/reports/financials/${type} failed`, err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
