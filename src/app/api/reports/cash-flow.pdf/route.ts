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
  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  const data = await accountsService.cashFlowStatement(session, {
    branchId,
    from: fromDate,
    to: toDate,
  });

  const bytes = await createSimplePdf({
    title: 'Cash Flow Statement',
    subtitle: `${from ?? fromDate.toISOString().slice(0, 10)} to ${to ?? toDate.toISOString().slice(0, 10)}`,
    sections: [
      {
        title: 'Operating Activities',
        rows: [
          ['Net profit', data.operating.netProfit.toString()],
          ['Depreciation', data.operating.depreciation.toString()],
          ['Inventory / working capital change', data.operating.inventoryChange.toString()],
          ['Net operating cash flow', data.operating.total.toString()],
        ],
      },
      {
        title: 'Investing Activities',
        rows: [
          ['Asset purchases', data.investing.assetPurchases.toString()],
          ['Net investing cash flow', data.investing.total.toString()],
        ],
      },
      {
        title: 'Financing Activities',
        rows: [
          ['Share capital change', data.financing.shareCapitalChange.toString()],
          ['Net financing cash flow', data.financing.total.toString()],
        ],
      },
      {
        title: 'Cash Summary',
        rows: [
          ['Opening cash', data.openingCash.toString()],
          ['Net cash change', data.netChange.toString()],
          ['Closing cash', data.closingCash.toString()],
        ],
      },
    ],
  });

  return pdfResponse(`cash-flow-${from ?? 'period'}-${to ?? 'latest'}.pdf`, bytes);
}
