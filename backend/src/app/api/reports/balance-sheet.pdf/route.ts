import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { accountsService } from '@/server/services/accounts.service';
import { createSimplePdf, pdfResponse } from '@/server/pdf/simple-pdf';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const sp = req.nextUrl.searchParams;
  const asOf = sp.get('asOf');
  const branchId = sp.get('branchId') ?? undefined;
  const data = await accountsService.balanceSheet(session, {
    branchId,
    asOf: asOf ? new Date(`${asOf}T23:59:59.999Z`) : undefined,
  });

  const bytes = await createSimplePdf({
    title: 'Balance Sheet',
    subtitle: `As of ${asOf ?? 'latest'}`,
    sections: [
      {
        title: 'Assets',
        table: {
          headers: ['Code', 'Account', 'Amount'],
          rows: data.asset.map((r) => [r.code, r.name, r.balance.toString()]),
        },
      },
      {
        title: 'Liabilities',
        table: {
          headers: ['Code', 'Account', 'Amount'],
          rows: data.liability.map((r) => [r.code, r.name, r.credit.minus(r.debit).toString()]),
        },
      },
      {
        title: 'Equity',
        table: {
          headers: ['Code', 'Account', 'Amount'],
          rows: data.equity.map((r) => [r.code, r.name, r.credit.minus(r.debit).toString()]),
        },
      },
      {
        title: 'Totals',
        rows: [
          ['Total assets', data.totals.asset.toString()],
          ['Total liabilities', data.totals.liability.toString()],
          ['Total equity', data.totals.equity.toString()],
          ['Retained earnings', data.totals.retained.toString()],
          ['Liabilities + equity', data.totals.liabilityPlusEquity.toString()],
        ],
      },
    ],
  });

  return pdfResponse(`balance-sheet-${asOf ?? 'latest'}.pdf`, bytes);
}
