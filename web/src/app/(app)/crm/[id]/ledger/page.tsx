import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill, type PillTone } from '@/components/shared/pill';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { formatCurrency, d } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

const REF_TYPE_TONE: Record<string, PillTone> = {
  PosSale: 'blue',
  PosReturn: 'blue',
  WholesaleInvoice: 'amber',
  WholesaleReturn: 'amber',
  CorporateInvoice: 'green',
  CUSTOMER: 'grey',
};

const REF_TYPE_LABEL: Record<string, string> = {
  PosSale: 'POS',
  PosReturn: 'POS',
  WholesaleInvoice: 'Wholesale',
  WholesaleReturn: 'Wholesale',
  CorporateInvoice: 'Corporate',
  CUSTOMER: 'Opening balance',
};

interface LedgerEntry {
  id: string;
  entryDate: string;
  entryType: string;
  refType: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

interface LedgerResponse {
  customer: { id: string; code: string; name: string; currency: string };
  entries: LedgerEntry[];
  currentBalance: string;
}

export default async function CustomerLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let ledger: LedgerResponse;
  try {
    ledger = await backendFetch<LedgerResponse>(`/api/mobile/crm/${id}/ledger`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const currency = ledger.customer.currency as CurrencyCode;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/crm/${ledger.customer.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <PageHeader
        title={`Ledger — ${ledger.customer.name}`}
        description={`${ledger.customer.code} · Current balance ${formatCurrency(ledger.currentBalance, currency)}`}
      />

      <Card className="p-0">
        <DataTable
          rows={ledger.entries}
          rowKey={(r) => r.id}
          empty="No ledger entries yet"
          columns={[
            {
              key: 'date',
              header: 'Date',
              cell: (r) => new Date(r.entryDate).toLocaleDateString(),
            },
            {
              key: 'type',
              header: 'Type',
              cell: (r) => (
                <div className="space-y-1">
                  <div>{r.entryType.toLowerCase()}</div>
                  <Pill tone={REF_TYPE_TONE[r.refType] ?? 'grey'} className="text-[10px]">
                    {REF_TYPE_LABEL[r.refType] ?? r.refType}
                  </Pill>
                </div>
              ),
            },
            { key: 'desc', header: 'Description', cell: (r) => r.description },
            {
              key: 'debit',
              header: 'Debit',
              align: 'right',
              cell: (r) =>
                d(r.debit).gt(0) ? (
                  <span className="tabular">{formatCurrency(r.debit, currency)}</span>
                ) : (
                  '—'
                ),
            },
            {
              key: 'credit',
              header: 'Credit',
              align: 'right',
              cell: (r) =>
                d(r.credit).gt(0) ? (
                  <span className="tabular text-emerald-600">
                    {formatCurrency(r.credit, currency)}
                  </span>
                ) : (
                  '—'
                ),
            },
            {
              key: 'balance',
              header: 'Balance',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-medium">
                  {formatCurrency(r.runningBalance, currency)}
                </span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
