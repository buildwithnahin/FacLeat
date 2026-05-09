import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { accountsService } from '@/server/services/accounts.service';
import { createSimplePdf, pdfResponse } from '@/server/pdf/simple-pdf';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  const branchId = sp.get('branchId') ?? undefined;
  const data = await accountsService.incomeStatement(session, {
    branchId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
  });

  const bytes = await createSimplePdf({
    title: 'Profit & Loss',
    subtitle: `${from ?? 'beginning'} to ${to ?? 'latest'}`,
    sections: [
      {
        title: 'Income',
        table: {
          headers: ['Code', 'Account', 'Amount'],
          rows: data.income.map((r) => [r.code, r.name, r.amount.toString()]),
        },
      },
      {
        title: 'Expenses',
        table: {
          headers: ['Code', 'Account', 'Amount'],
          rows: data.expense.map((r) => [r.code, r.name, r.amount.toString()]),
        },
      },
      {
        title: 'Totals',
        rows: [
          ['Total income', data.totals.income.toString()],
          ['Total expense', data.totals.expense.toString()],
          ['Net profit', data.totals.net.toString()],
        ],
      },
    ],
  });

  return pdfResponse(`income-statement-${from ?? 'all'}-${to ?? 'latest'}.pdf`, bytes);
}
