import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { KpiCard } from '@/components/shared/kpi-card';
import { AlertBanner } from '@/components/shared/alert-banner';
import { backendFetch } from '@/lib/backend-client';
import { d, formatCurrency } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Due & Payment Management' };

const HIGH_DUE_THRESHOLD = d(30000);

interface SupplierDueRow {
  id: string;
  code: string;
  name: string;
  currency: 'BDT' | 'INR' | 'USD' | 'EUR';
  status: string;
  paymentTerms: string;
  totalPurchase: string;
  dueAmount: string;
}

interface SupplierPaymentRow {
  id: string;
  number: string;
  paymentDate: string;
  amount: string;
  currency: 'BDT' | 'INR' | 'USD' | 'EUR';
  method: string;
  reference: string | null;
  supplier: { id: string; name: string };
  invoice: { id: string; number: string } | null;
}

export default async function SupplierPaymentsPage() {
  const [suppliers, payments] = await Promise.all([
    backendFetch<SupplierDueRow[]>('/api/mobile/suppliers'),
    backendFetch<SupplierPaymentRow[]>('/api/mobile/suppliers/payments?limit=30'),
  ]);

  const totalOutstanding = suppliers.reduce(
    (acc, s) => acc.plus(d(s.dueAmount).gt(0) ? s.dueAmount : 0),
    d(0),
  );
  const suppliersWithDue = suppliers.filter((s) => d(s.dueAmount).gt(0));
  const highPriority = suppliers.filter((s) => d(s.dueAmount).gt(HIGH_DUE_THRESHOLD));
  const cleared = suppliers.filter((s) => d(s.dueAmount).lte(0) && s.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Due & Payment Management"
        description="Track and manage supplier payments"
      >
        <Button variant="dark" asChild>
          <Link href="/suppliers">
            <CreditCard className="h-4 w-4" />
            Browse Suppliers
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Total Outstanding"
          value={formatCurrency(totalOutstanding, 'BDT')}
          tone="danger"
          description={`${suppliersWithDue.length} suppliers with due`}
        />
        <KpiCard
          label="High Priority"
          value={highPriority.length}
          tone="warning"
          description={`Dues above ${formatCurrency(HIGH_DUE_THRESHOLD, 'BDT')}`}
        />
        <KpiCard
          label="Cleared Suppliers"
          value={cleared.length}
          tone="success"
          description="No outstanding dues"
        />
      </div>

      {highPriority.length > 0 && (
        <AlertBanner
          tone="danger"
          title={`${highPriority.length} supplier${highPriority.length === 1 ? '' : 's'} have high pending dues`}
        >
          <span>
            Dues exceed {formatCurrency(HIGH_DUE_THRESHOLD, 'BDT')}. Prioritize settlement.
          </span>
        </AlertBanner>
      )}

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">Supplier Due Summary</div>
        <DataTable
          rows={suppliers}
          rowKey={(r) => r.id}
          empty="No suppliers configured"
          columns={[
            { key: 'code', header: 'Supplier ID', cell: (r) => <span className="tabular">{r.code}</span> },
            {
              key: 'name',
              header: 'Supplier Name',
              cell: (r) => (
                <Link href={`/suppliers/${r.id}`} className="text-blue-600 hover:underline">
                  {r.name}
                </Link>
              ),
            },
            {
              key: 'totalPurchase',
              header: 'Total Purchase',
              align: 'right',
              cell: (r) => <span className="tabular">{formatCurrency(r.totalPurchase, r.currency)}</span>,
            },
            {
              key: 'due',
              header: 'Due Amount',
              align: 'right',
              cell: (r) => {
                const isDue = d(r.dueAmount).gt(0);
                return (
                  <span className={`tabular font-medium ${isDue ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(r.dueAmount, r.currency)}
                  </span>
                );
              },
            },
            { key: 'terms', header: 'Terms', cell: (r) => r.paymentTerms.replace('_', ' ') },
            {
              key: 'priority',
              header: 'Priority',
              cell: (r) => {
                if (d(r.dueAmount).lte(0)) return <Pill tone="green">Cleared</Pill>;
                if (d(r.dueAmount).gt(HIGH_DUE_THRESHOLD)) return <Pill tone="red">High</Pill>;
                return <Pill tone="orange">Medium</Pill>;
              },
            },
            {
              key: 'action',
              header: 'Actions',
              align: 'right',
              cell: (r) => (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/suppliers/${r.id}/pay`}>Pay Now</Link>
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">Recent Payments</div>
        <DataTable
          rows={payments}
          rowKey={(r) => r.id}
          empty="No payments recorded yet"
          columns={[
            { key: 'number', header: 'Payment ID', cell: (r) => <span className="tabular">{r.number}</span> },
            { key: 'date', header: 'Date', cell: (r) => new Date(r.paymentDate).toLocaleDateString() },
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
              key: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (r) => <span className="tabular text-emerald-600">{formatCurrency(r.amount, r.currency)}</span>,
            },
            { key: 'method', header: 'Method', cell: (r) => r.method.replace('_', ' ').toLowerCase() },
            { key: 'ref', header: 'Reference', cell: (r) => <span className="tabular">{r.reference ?? '—'}</span> },
            {
              key: 'invoice',
              header: 'Invoice',
              cell: (r) => (r.invoice ? <span className="tabular">{r.invoice.number}</span> : '—'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
