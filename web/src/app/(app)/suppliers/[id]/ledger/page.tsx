import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, CreditCard, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/shared/kpi-card';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { AlertBanner } from '@/components/shared/alert-banner';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { d, formatCurrency } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';
import { LedgerActions } from './ledger-actions';

export const dynamic = 'force-dynamic';

interface LedgerEntry {
  id: string;
  entryDate: string;
  entryType: string;
  description: string;
  refType: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

interface SupplierLedgerData {
  supplier: {
    id: string;
    name: string;
    code: string;
    paymentTerms: string;
    currency: string;
    branch?: { name: string; code: string };
  };
  entries: LedgerEntry[];
  totalDebit: string;
  totalCredit: string;
  currentBalance: string;
}

export default async function SupplierLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: SupplierLedgerData;
  try {
    data = await backendFetch<SupplierLedgerData>(`/api/mobile/suppliers/${id}/ledger`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }
  const currency = (data.supplier.currency || 'BDT') as CurrencyCode;
  const isDue = d(data.currentBalance).gt(0);

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/suppliers/${data.supplier.id}`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Supplier Profile
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {isDue && (
            <Button variant="dark" size="sm" asChild>
              <Link href={`/suppliers/${data.supplier.id}/pay`}>
                <CreditCard className="h-4 w-4 mr-1.5" />
                Record Payment
              </Link>
            </Button>
          )}
          <LedgerActions
            supplier={{
              code: data.supplier.code,
              name: data.supplier.name,
              currency: data.supplier.currency,
            }}
            entries={data.entries}
            currentBalance={data.currentBalance}
          />
        </div>
      </div>

      {/* Printable Statement Header (visible on print or screen) */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ANNEX LEATHER</h1>
            <p className="text-sm text-muted-foreground">Supplier Statement of Account</p>
          </div>
          <div className="text-right text-xs">
            <p><strong>Date Generated:</strong> {new Date().toLocaleDateString()}</p>
            <p><strong>Currency:</strong> {currency}</p>
          </div>
        </div>
      </div>

      <PageHeader
        title={`${data.supplier.name} — Ledger Statement`}
        description={`Supplier ID: ${data.supplier.code} · Running audit trail of all purchases, payments, and balances`}
        className="print:hidden"
      />

      {/* Supplier Profile Card */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</p>
            <p className="text-xl font-bold mt-0.5">{data.supplier.name}</p>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">{data.supplier.code}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Terms</p>
            <p className="text-sm font-medium mt-0.5">{data.supplier.paymentTerms.replace(/_/g, ' ')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Billing Currency: {currency}</p>
          </div>
          <div className="md:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Closing Position</p>
            <p className={`text-xl font-black mt-0.5 ${isDue ? 'text-destructive' : 'text-emerald-600'}`}>
              {formatCurrency(data.currentBalance, currency)}
            </p>
            <span className="text-xs font-medium">
              {isDue ? '(Net Payable Outstanding)' : '(Account Cleared / In Advance)'}
            </span>
          </div>
        </div>
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Total Debits (Purchases & Dues)"
          value={formatCurrency(data.totalDebit, currency)}
          tone="danger"
          description="Increases accounts payable balance"
        />
        <KpiCard
          label="Total Credits (Payments & Settlements)"
          value={formatCurrency(data.totalCredit, currency)}
          tone="success"
          description="Decreases accounts payable balance"
        />
        <KpiCard
          label="Net Balance Due"
          value={formatCurrency(data.currentBalance, currency)}
          tone={isDue ? 'danger' : 'success'}
          description={isDue ? 'Immediate liability payable' : 'No overdue liabilities'}
        />
      </div>

      {/* Ledger Table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span>Ledger Entries ({data.entries.length} Transaction{data.entries.length === 1 ? '' : 's'})</span>
          </div>
          <span className="text-xs text-muted-foreground">Chronological Order</span>
        </div>
        <DataTable
          rows={data.entries}
          rowKey={(r) => r.id}
          empty="No ledger transactions recorded for this supplier."
          columns={[
            {
              key: 'date',
              header: 'Date',
              cell: (r) => (
                <span className="tabular text-xs font-medium">
                  {new Date(r.entryDate).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: 'type',
              header: 'Entry Type',
              cell: (r) => (
                <Pill
                  tone={
                    r.entryType === 'PURCHASE'
                      ? 'red'
                      : r.entryType === 'PAYMENT'
                        ? 'green'
                        : r.entryType === 'OPENING'
                          ? 'blue'
                          : 'neutral'
                  }
                >
                  {r.entryType.toLowerCase()}
                </Pill>
              ),
            },
            {
              key: 'description',
              header: 'Description',
              cell: (r) => <span className="text-sm font-normal">{r.description}</span>,
            },
            {
              key: 'ref',
              header: 'Ref Type',
              cell: (r) => (
                <span className="font-mono text-xs text-muted-foreground">{r.refType}</span>
              ),
            },
            {
              key: 'debit',
              header: 'Debit (+)',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-medium text-destructive">
                  {d(r.debit).gt(0) ? formatCurrency(r.debit, currency) : '—'}
                </span>
              ),
            },
            {
              key: 'credit',
              header: 'Credit (-)',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-medium text-emerald-600">
                  {d(r.credit).gt(0) ? formatCurrency(r.credit, currency) : '—'}
                </span>
              ),
            },
            {
              key: 'balance',
              header: 'Running Balance',
              align: 'right',
              cell: (r) => {
                const bal = d(r.runningBalance);
                return (
                  <span className={`tabular font-bold ${bal.gt(0) ? 'text-foreground' : 'text-emerald-600'}`}>
                    {formatCurrency(r.runningBalance, currency)}
                  </span>
                );
              },
              headerClassName: 'bg-muted/40',
              className: 'bg-muted/20',
            },
          ]}
        />
      </Card>

      {/* Accounting Guidance Banner */}
      <AlertBanner tone="info" title="Ledger Double-Entry Mechanics" className="print:hidden">
        <ul className="mt-1 space-y-1 text-xs">
          <li>
            • <strong>Debit (+):</strong> Purchase orders and purchase invoices increase accounts payable liability (Dr Purchases / Inventory, Cr Accounts Payable).
          </li>
          <li>
            • <strong>Credit (-):</strong> Disbursements and bank/cash transfers decrease liability (Dr Accounts Payable, Cr Cash / Bank).
          </li>
          <li>
            • <strong>Running Balance:</strong> Continuous cumulative balance ($\sum \text{Debit} - \sum \text{Credit}$). A positive balance represents outstanding company liability payable to the vendor.
          </li>
        </ul>
      </AlertBanner>
    </div>
  );
}
