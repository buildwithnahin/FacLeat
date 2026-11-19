import Link from 'next/link';
import { CreditCard, ArrowLeft, CheckCircle2, AlertTriangle, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { KpiCard } from '@/components/shared/kpi-card';
import { AlertBanner } from '@/components/shared/alert-banner';
import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';
import { d, formatCurrency } from '@/lib/money';
import { PaymentsExportButton } from './payments-export-button';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Supplier Payment Register & Dues' };

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
  const session = await getSession();
  const branchId =
    session?.activeBranchId ??
    session?.defaultBranchId ??
    session?.allowedBranchIds?.[0] ??
    undefined;
  const bParam = branchId ? `branchId=${encodeURIComponent(branchId)}` : '';

  const [suppliers, payments] = await Promise.all([
    backendFetch<SupplierDueRow[]>(`/api/mobile/suppliers${bParam ? `?${bParam}` : ''}`),
    backendFetch<SupplierPaymentRow[]>(`/api/mobile/suppliers/payments?limit=50${bParam ? `&${bParam}` : ''}`),
  ]);

  const totalOutstanding = suppliers.reduce(
    (acc, s) => acc.plus(d(s.dueAmount).gt(0) ? s.dueAmount : 0),
    d(0),
  );
  const totalPaidRecent = payments.reduce((acc, p) => acc.plus(d(p.amount || 0)), d(0));
  const suppliersWithDue = suppliers.filter((s) => d(s.dueAmount).gt(0));
  const highPriority = suppliers.filter((s) => d(s.dueAmount).gt(HIGH_DUE_THRESHOLD));
  const cleared = suppliers.filter((s) => d(s.dueAmount).lte(0) && s.status === 'ACTIVE');

  // Breakdown by method
  const bankPayments = payments.filter((p) => p.method === 'BANK_TRANSFER' || p.method === 'WIRE_TRANSFER');
  const cashPayments = payments.filter((p) => p.method === 'CASH');
  const chequePayments = payments.filter((p) => p.method === 'CHEQUE');
  const mobilePayments = payments.filter((p) => p.method === 'MOBILE_BANKING');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/suppliers">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Suppliers
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Supplier Payments & Dues"
        description="Monitor outstanding vendor balances, prioritize upcoming liabilities, and review disbursement vouchers"
      >
        <div className="flex items-center gap-2">
          <PaymentsExportButton payments={payments} />
          <Button variant="dark" asChild>
            <Link href="/suppliers">
              <CreditCard className="h-4 w-4 mr-1.5" />
              Make a Payment
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Outstanding AP"
          value={formatCurrency(totalOutstanding, 'BDT')}
          tone="danger"
          description={`${suppliersWithDue.length} suppliers requiring settlement`}
        />
        <KpiCard
          label="High Priority Dues"
          value={highPriority.length}
          tone={highPriority.length > 0 ? 'warning' : 'neutral'}
          description={`Over ${formatCurrency(HIGH_DUE_THRESHOLD, 'BDT')} threshold`}
        />
        <KpiCard
          label="Cleared Vendors"
          value={cleared.length}
          tone="success"
          description="Zero outstanding liabilities"
        />
        <KpiCard
          label="Disbursed (Recent)"
          value={formatCurrency(totalPaidRecent, 'BDT')}
          description={`${payments.length} payment vouchers`}
        />
      </div>

      {/* Tender Method Distribution */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Bank Transfers</p>
          <p className="text-lg font-bold">
            {formatCurrency(bankPayments.reduce((acc, p) => acc.plus(d(p.amount || 0)), d(0)), 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground">{bankPayments.length} transactions</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Cash Disbursements</p>
          <p className="text-lg font-bold">
            {formatCurrency(cashPayments.reduce((acc, p) => acc.plus(d(p.amount || 0)), d(0)), 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground">{cashPayments.length} transactions</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Cheque Payments</p>
          <p className="text-lg font-bold">
            {formatCurrency(chequePayments.reduce((acc, p) => acc.plus(d(p.amount || 0)), d(0)), 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground">{chequePayments.length} transactions</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Mobile Banking (bKash/Nagad)</p>
          <p className="text-lg font-bold">
            {formatCurrency(mobilePayments.reduce((acc, p) => acc.plus(d(p.amount || 0)), d(0)), 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground">{mobilePayments.length} transactions</p>
        </div>
      </div>

      {highPriority.length > 0 && (
        <AlertBanner
          tone="danger"
          title={`${highPriority.length} vendor${highPriority.length === 1 ? '' : 's'} have dues exceeding ${formatCurrency(HIGH_DUE_THRESHOLD, 'BDT')}`}
        >
          <span>
            Immediate payment allocation recommended to avoid supplier hold or procurement disruptions.
          </span>
        </AlertBanner>
      )}

      {/* Supplier Due Summary Table */}
      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
          <span>Supplier Aging & Outstanding Balances</span>
          <span className="text-xs text-muted-foreground">{suppliers.length} Vendors</span>
        </div>
        <DataTable
          rows={suppliers}
          rowKey={(r) => r.id}
          empty="No suppliers configured."
          columns={[
            {
              key: 'code',
              header: 'Supplier Code',
              cell: (r) => (
                <Link href={`/suppliers/${r.id}`} className="font-mono text-xs font-semibold hover:underline">
                  {r.code}
                </Link>
              ),
            },
            {
              key: 'name',
              header: 'Supplier Name',
              cell: (r) => (
                <Link href={`/suppliers/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
              ),
            },
            {
              key: 'totalPurchase',
              header: 'Total Procured',
              align: 'right',
              cell: (r) => (
                <span className="tabular">{formatCurrency(r.totalPurchase, r.currency)}</span>
              ),
            },
            {
              key: 'due',
              header: 'Outstanding Due',
              align: 'right',
              cell: (r) => {
                const isDue = d(r.dueAmount).gt(0);
                return (
                  <span className={`tabular font-bold ${isDue ? 'text-destructive' : 'text-emerald-600'}`}>
                    {formatCurrency(r.dueAmount, r.currency)}
                  </span>
                );
              },
            },
            {
              key: 'terms',
              header: 'Payment Terms',
              cell: (r) => <span className="text-xs font-medium">{r.paymentTerms.replace(/_/g, ' ')}</span>,
            },
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
              cell: (r) => {
                const isDue = d(r.dueAmount).gt(0);
                return (
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="ghost" asChild className="h-8 px-2 text-xs">
                      <Link href={`/suppliers/${r.id}/ledger`}>Ledger</Link>
                    </Button>
                    {isDue && (
                      <Button size="sm" variant="outline" asChild className="h-8 px-2.5 text-xs font-semibold">
                        <Link href={`/suppliers/${r.id}/pay`}>Pay Now</Link>
                      </Button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </Card>

      {/* Recent Payments Journal */}
      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <span>Recent Disbursement Journal</span>
          </div>
          <span className="text-xs text-muted-foreground">Double-entry GL posted vouchers</span>
        </div>
        <DataTable
          rows={payments}
          rowKey={(r) => r.id}
          empty="No supplier payments recorded yet."
          columns={[
            {
              key: 'number',
              header: 'Payment Voucher',
              cell: (r) => <span className="font-mono text-xs font-semibold">{r.number}</span>,
            },
            {
              key: 'date',
              header: 'Date',
              cell: (r) => (
                <span className="tabular text-xs">
                  {new Date(r.paymentDate).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: 'supplier',
              header: 'Supplier',
              cell: (r) => (
                <Link href={`/suppliers/${r.supplier.id}`} className="font-medium hover:underline">
                  {r.supplier.name}
                </Link>
              ),
            },
            {
              key: 'amount',
              header: 'Amount Paid',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-bold text-emerald-600">
                  {formatCurrency(r.amount, r.currency)}
                </span>
              ),
            },
            {
              key: 'method',
              header: 'Tender Method',
              cell: (r) => (
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {r.method.replace(/_/g, ' ')}
                </span>
              ),
            },
            {
              key: 'ref',
              header: 'Reference',
              cell: (r) => (
                <span className="font-mono text-xs text-muted-foreground">{r.reference ?? '—'}</span>
              ),
            },
            {
              key: 'invoice',
              header: 'Applied Invoice',
              cell: (r) => (
                r.invoice ? (
                  <span className="font-mono text-xs text-primary font-medium">{r.invoice.number}</span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">On-account / General</span>
                )
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
