import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { formatCurrency, type CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Foreign Payments' };

interface Row {
  id: string;
  number: string;
  amount: string;
  currency: CurrencyCode;
  exchangeRate: string;
  localAmount: string;
  bankName: string | null;
  swiftRef: string | null;
  paymentDate: string | null;
  tradeOrder: { id: string; number: string; type: string };
}

const columns: DataTableColumn<Row>[] = [
  {
    key: 'number', header: 'Payment #',
    cell: (r) => <span className="font-mono text-sm">{r.number}</span>,
  },
  {
    key: 'order', header: 'Trade Order',
    cell: (r) => (
      <Link href={`/trade/orders/${r.tradeOrder.id}`} className="text-primary hover:underline text-sm font-mono">
        {r.tradeOrder.number}
      </Link>
    ),
  },
  {
    key: 'amount', header: 'Amount', align: 'right',
    cell: (r) => formatCurrency(r.amount, r.currency),
  },
  {
    key: 'rate', header: 'Rate', align: 'right',
    cell: (r) => <span className="tabular-nums text-xs">{r.exchangeRate}</span>,
  },
  {
    key: 'local', header: 'Local (BDT)', align: 'right',
    cell: (r) => formatCurrency(r.localAmount, 'BDT'),
  },
  { key: 'bank', header: 'Bank', cell: (r) => r.bankName ?? '—' },
  {
    key: 'swift', header: 'SWIFT Ref',
    cell: (r) => <span className="font-mono text-xs">{r.swiftRef ?? '—'}</span>,
  },
  {
    key: 'date', header: 'Payment Date',
    cell: (r) => r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : '—',
  },
];

export default async function TradePaymentsPage() {
  const session = await getSession();
  const branchId =
    session?.activeBranchId ??
    session?.defaultBranchId ??
    session?.allowedBranchIds?.[0] ??
    undefined;
  const qs = new URLSearchParams(branchId ? { branchId } : {});
  const rows = await backendFetch<Row[]>(`/api/mobile/trade/payments?${qs.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader title="Foreign Payments" description="SWIFT/TT payments with exchange rate tracking." />
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} empty="No payments recorded." />
    </div>
  );
}
