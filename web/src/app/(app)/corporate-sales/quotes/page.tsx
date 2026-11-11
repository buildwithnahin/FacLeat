import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { backendFetch } from '@/lib/backend-client';
import { formatCurrency } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Corporate Quotes' };

const STATUS_TONE: Record<string, PillTone> = {
  DRAFT: 'grey',
  SENT: 'blue',
  ACCEPTED: 'green',
  REJECTED: 'red',
  EXPIRED: 'amber',
  CONVERTED: 'black',
};

const STATUSES = ['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];

interface QuoteRow {
  id: string;
  number: string;
  quoteDate: string;
  validUntil: string | null;
  customer: { code: string; name: string };
  _count: { items: number };
  grandTotal: string;
  currency: 'BDT' | 'INR' | 'USD' | 'EUR';
  status: string;
}

export default async function CorporateQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') qs.set('status', sp.status);
  if (sp.search) qs.set('search', sp.search);
  const quotes = await backendFetch<QuoteRow[]>(
    `/api/mobile/corporate-sales/quotes?${qs.toString()}`,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" description="All corporate quotations.">
        <Button variant="dark" asChild>
          <Link href="/corporate-sales/quotes/new">New quote</Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-end">
          <Input name="search" placeholder="Search…" defaultValue={sp.search ?? ''} />
          <select
            name="status"
            defaultValue={sp.status ?? 'ALL'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
          <Button variant="outline" type="submit">Filter</Button>
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          {quotes.length} quote{quotes.length === 1 ? '' : 's'}
        </div>
        <DataTable
          rows={quotes}
          rowKey={(r) => r.id}
          empty="No quotes yet."
          columns={[
            {
              key: 'number',
              header: 'Number',
              cell: (r) => (
                <Link
                  href={`/corporate-sales/quotes/${r.id}`}
                  className="text-blue-600 hover:underline tabular"
                >
                  {r.number}
                </Link>
              ),
            },
            {
              key: 'date',
              header: 'Date',
              cell: (r) => <span className="tabular">{new Date(r.quoteDate).toISOString().slice(0, 10)}</span>,
            },
            {
              key: 'valid',
              header: 'Valid until',
              cell: (r) =>
                r.validUntil ? (
                  <span className="tabular">{new Date(r.validUntil).toISOString().slice(0, 10)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: 'customer',
              header: 'Customer',
              cell: (r) => `${r.customer.code} · ${r.customer.name}`,
            },
            {
              key: 'items',
              header: 'Items',
              align: 'right',
              cell: (r) => <span className="tabular">{r._count.items}</span>,
            },
            {
              key: 'total',
              header: 'Total',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-medium">
                  {formatCurrency(r.grandTotal, r.currency)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={STATUS_TONE[r.status] ?? 'grey'}>{r.status.toLowerCase()}</Pill>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
