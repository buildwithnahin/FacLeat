import { NextRequest } from 'next/server';
import { backendFetch } from '@/lib/backend-client';
import { csvResponse, toCsv } from '@/lib/csv';

interface SalesChannel {
  key: string;
  label: string;
  count: number;
  gross: string;
  discount: string;
  tax: string;
  paid: string;
  outstanding: string;
}

interface SalesSummaryDto {
  channels: SalesChannel[];
  totals: Omit<SalesChannel, 'key' | 'label'>;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  const branchId = sp.get('branchId') ?? undefined;

  const qs = new URLSearchParams();
  if (from) qs.set('from', new Date(from).toISOString());
  if (to) qs.set('to', new Date(`${to}T23:59:59.999Z`).toISOString());
  if (branchId) qs.set('branchId', branchId);

  const data = await backendFetch<SalesSummaryDto>(`/api/mobile/reports/general/sales-summary?${qs.toString()}`);

  const headers = ['Channel', 'Invoices', 'Gross', 'Discount', 'Tax', 'Paid', 'Outstanding'];
  const rows = data.channels.map((c) => [c.label, c.count, c.gross, c.discount, c.tax, c.paid, c.outstanding]);
  rows.push([
    'Total',
    data.totals.count,
    data.totals.gross,
    data.totals.discount,
    data.totals.tax,
    data.totals.paid,
    data.totals.outstanding,
  ]);

  return csvResponse(`sales-${from ?? 'all'}-${to ?? 'all'}.csv`, toCsv(headers, rows));
}
