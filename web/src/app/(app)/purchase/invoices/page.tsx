import Link from 'next/link';
import { Plus, Eye, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/shared/pill';
import { DataTable } from '@/components/shared/data-table';
import { StepIndicator } from '@/components/shared/step-indicator';
import { AlertBanner } from '@/components/shared/alert-banner';
import { backendFetch } from '@/lib/backend-client';
import { formatCurrency } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Purchase Invoices' };

const STATUS_TONE = {
  DRAFT: 'blue',
  PENDING: 'amber',
  PARTIALLY_PAID: 'orange',
  PAID: 'green',
  CANCELLED: 'red',
} as const;

interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  matching: string;
  currency: CurrencyCode;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  dueDate: string;
  supplier: { id: string; name: string };
  purchaseOrder: { id: string; number: string } | null;
  grn: { id: string; number: string } | null;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string; status?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const params = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') params.set('status', sp.status);
  if (sp.search?.trim()) params.set('search', sp.search.trim());
  const invoices = await backendFetch<InvoiceRow[]>(`/api/mobile/purchase/invoices?${params.toString()}`);
  const isFiltered = Boolean(sp.search?.trim() || (sp.status && sp.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Invoice"
        description="Record and match supplier invoices"
      >
        <Button variant="dark" asChild>
          <Link href="/purchase/invoices/new">
            <Plus className="h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
      </PageHeader>

      <AlertBanner tone="info" title="3-Way Matching">
        Invoices are automatically matched with Purchase Orders and GRN records to ensure
        accuracy and prevent discrepancies.
      </AlertBanner>

      <StepIndicator
        steps={[
          { key: 'pr', label: 'PR', state: 'completed' },
          { key: 'po', label: 'PO', state: 'completed' },
          { key: 'grn', label: 'GRN', state: 'completed' },
          { key: 'invoice', label: 'Invoice', state: 'active' },
          { key: 'payment', label: 'Payment', state: 'pending' },
        ]}
      />

      <Card className="p-4">
        <form className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              placeholder="Search Invoice #, supplier, PO #…"
              defaultValue={sp.search ?? ''}
              className="pl-9"
            />
          </div>
          <select
            name="status"
            defaultValue={sp.status ?? 'ALL'}
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIALLY_PAID">Partially paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {isFiltered && (
            <Button variant="ghost" asChild>
              <Link href="/purchase/invoices">Clear</Link>
            </Button>
          )}
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">All Invoices ({invoices.length})</div>
        <DataTable
          rows={invoices}
          rowKey={(r) => r.id}
          empty="No invoices yet."
          columns={[
            {
              key: 'number',
              header: 'Invoice #',
              cell: (r) => (
                <Link
                  href={`/purchase/invoices/${r.id}`}
                  className="text-blue-600 hover:underline tabular"
                >
                  {r.number}
                </Link>
              ),
            },
            {
              key: 'supplier',
              header: 'Supplier',
              cell: (r) => (
                <Link href={`/suppliers/${r.supplier.id}`} className="text-blue-600 hover:underline">
                  {r.supplier.name}
                </Link>
              ),
            },
            {
              key: 'po',
              header: 'PO Ref',
              cell: (r) =>
                r.purchaseOrder ? (
                  <Link
                    href={`/purchase/orders/${r.purchaseOrder.id}`}
                    className="text-blue-600 hover:underline tabular"
                  >
                    {r.purchaseOrder.number}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              key: 'grn',
              header: 'GRN Ref',
              cell: (r) =>
                r.grn ? <span className="tabular">{r.grn.number}</span> : <span className="text-muted-foreground">—</span>,
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (r) => <span className="tabular">{formatCurrency(r.subtotal, r.currency)}</span>,
            },
            {
              key: 'tax',
              header: 'Tax',
              align: 'right',
              cell: (r) => <span className="tabular">{formatCurrency(r.taxTotal, r.currency)}</span>,
            },
            {
              key: 'total',
              header: 'Total',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-medium">{formatCurrency(r.grandTotal, r.currency)}</span>
              ),
            },
            {
              key: 'due',
              header: 'Due Date',
              cell: (r) => new Date(r.dueDate).toLocaleDateString(),
            },
            {
              key: 'matching',
              header: 'Matching',
              cell: (r) => (
                <Pill tone={r.matching === 'MATCHED' ? 'green' : r.matching === 'MISMATCH' ? 'red' : 'grey'}>
                  {r.matching.toLowerCase()}
                </Pill>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? 'neutral'}>
                  {r.status.replace('_', ' ').toLowerCase()}
                </Pill>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              cell: (r) => (
                <Link
                  href={`/purchase/invoices/${r.id}`}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
