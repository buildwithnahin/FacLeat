import { NextRequest } from 'next/server';
import { backendFetch } from '@/lib/backend-client';
import { csvResponse, toCsv } from '@/lib/csv';

interface CashFlowSourceDto {
  key: string;
  label: string;
  count: number;
  amount: string;
}

interface CashFlowRowDto {
  id: string;
  date: string;
  flow: 'IN' | 'OUT';
  source: string;
  ref: string;
  party: string;
  method: string;
  branch: string;
  amount: string;
}

interface CashFlowReportDto {
  totalIncome: string;
  totalOutcome: string;
  net: string;
  incomeSources: CashFlowSourceDto[];
  outcomeSources: CashFlowSourceDto[];
  rows: CashFlowRowDto[];
}

/**
 * Web-origin CSV export for the cash-flow page's "Download CSV" button
 * (`web/src/app/(app)/cash-flow/page.tsx`). Mirrors `reports/inventory.csv`
 * and `reports/sales.csv`: fetch the already-existing Bearer-authenticated
 * JSON report from backend/ via `backendFetch`, then build the CSV here in
 * web/ with the same column layout backend/'s legacy
 * `/api/reports/cash-flow.csv` (cookie-session) route used to produce.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  const branchId = sp.get('branchId') ?? undefined;

  const qs = new URLSearchParams();
  if (from) qs.set('from', new Date(from).toISOString());
  if (to) qs.set('to', new Date(`${to}T23:59:59.999Z`).toISOString());
  if (branchId) qs.set('branchId', branchId);

  const data = await backendFetch<CashFlowReportDto>(`/api/mobile/reports/general/cash-flow?${qs.toString()}`);

  const headers = ['Date', 'Flow', 'Source', 'Reference', 'Party', 'Method', 'Branch', 'Amount'];
  const rows: (string | number)[][] = data.rows.map((r) => [
    new Date(r.date).toISOString().slice(0, 10),
    r.flow,
    r.source,
    r.ref,
    r.party,
    r.method,
    r.branch,
    (r.flow === 'IN' ? '' : '-') + r.amount,
  ]);

  rows.push([], ['--- Income summary ---'], ['Source', '', '', '', '', '', '', 'Amount']);
  for (const s of data.incomeSources) {
    rows.push([s.label, '', '', '', '', '', `${s.count} txns`, s.amount]);
  }
  rows.push(['Total income', '', '', '', '', '', '', data.totalIncome]);
  rows.push([], ['--- Outcome summary ---'], ['Source', '', '', '', '', '', '', 'Amount']);
  for (const s of data.outcomeSources) {
    rows.push([s.label, '', '', '', '', '', `${s.count} txns`, s.amount]);
  }
  rows.push(['Total outcome', '', '', '', '', '', '', data.totalOutcome]);
  rows.push(['Net cash', '', '', '', '', '', '', data.net]);

  return csvResponse(`cash-flow-${from ?? 'all'}-${to ?? 'all'}.csv`, toCsv(headers, rows));
}
