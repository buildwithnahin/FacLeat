import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Edit, CreditCard, BookOpen, ArrowLeft, Phone, Mail, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/shared/pill';
import { DataTable } from '@/components/shared/data-table';
import { KpiCard } from '@/components/shared/kpi-card';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { d, formatCurrency } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

interface SupplierDetail {
  id: string;
  code: string;
  name: string;
  status: string;
  paymentTerms: string;
  currency: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
  notes: string | null;
  branch: { id: string; name: string; code: string; currency: string };
  totalPurchase: string | null;
  dueAmount: string | null;
  purchaseOrders: {
    id: string;
    number: string;
    status: string;
    orderDate: string;
    grandTotal: string;
  }[];
  purchaseInvoices: {
    id: string;
    number: string;
    status: string;
    invoiceDate: string;
    dueDate: string;
    grandTotal: string;
    paidAmount: string;
  }[];
  payments: {
    id: string;
    number: string;
    method: string;
    paymentDate: string;
    amount: string;
    reference: string | null;
  }[];
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let supplier: SupplierDetail;
  try {
    supplier = await backendFetch<SupplierDetail>(`/api/mobile/suppliers/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  const totalPurchase = supplier.totalPurchase;
  const dueAmount = supplier.dueAmount;
  const currency = (supplier.currency || 'BDT') as CurrencyCode;
  const isDue = dueAmount && d(dueAmount).gt(0);

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
        title={supplier.name}
        description={`Supplier ID: ${supplier.code} · ${supplier.branch.name} (${supplier.branch.code})`}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/suppliers/${supplier.id}/ledger`}>
              <BookOpen className="h-4 w-4 mr-1.5" />
              Statement / Ledger
            </Link>
          </Button>
          {isDue && (
            <Button variant="outline" asChild>
              <Link href={`/suppliers/${supplier.id}/pay`}>
                <CreditCard className="h-4 w-4 mr-1.5" />
                Record Payment
              </Link>
            </Button>
          )}
          <Button variant="dark" asChild>
            <Link href={`/suppliers/${supplier.id}/edit`}>
              <Edit className="h-4 w-4 mr-1.5" />
              Edit Supplier
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Account Status"
          value={
            <Pill tone={supplier.status === 'ACTIVE' ? 'green' : supplier.status === 'BLOCKED' ? 'red' : 'neutral'}>
              {supplier.status.toLowerCase()}
            </Pill>
          }
          description={supplier.paymentTerms.replace(/_/g, ' ')}
        />
        <KpiCard
          label="Total Procurement"
          value={formatCurrency(totalPurchase ?? 0, currency)}
          description="Lifetime purchase debit"
        />
        <KpiCard
          label="Outstanding Due"
          value={formatCurrency(dueAmount ?? 0, currency)}
          tone={isDue ? 'danger' : 'success'}
          description={isDue ? 'Unpaid liability balance' : 'Account fully settled'}
        />
        <KpiCard
          label="Payment Terms"
          value={supplier.paymentTerms.replace(/_/g, ' ')}
          description={`Operating Currency: ${currency}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-6 space-y-4 text-sm">
            <p className="text-sm font-semibold border-b pb-2">Supplier Profile</p>
            {supplier.contactPerson && (
              <div>
                <p className="text-xs text-muted-foreground">Contact Person</p>
                <p className="font-medium">{supplier.contactPerson}</p>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span className="text-foreground">{supplier.phone}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="text-foreground">{supplier.email}</span>
              </div>
            )}
            {(supplier.address || supplier.city || supplier.country) && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="text-foreground">
                  {[supplier.address, supplier.city, supplier.country].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {supplier.taxId && (
              <div>
                <p className="text-xs text-muted-foreground">Tax / VAT ID</p>
                <p className="font-mono text-sm">{supplier.taxId}</p>
              </div>
            )}
            {supplier.notes && (
              <div>
                <p className="text-xs text-muted-foreground">Internal Notes</p>
                <p className="text-xs text-muted-foreground mt-0.5">{supplier.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 p-0">
          <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
            <span>Recent Purchase Orders</span>
            <span className="text-xs text-muted-foreground">{supplier.purchaseOrders.length} Recent</span>
          </div>
          <DataTable
            rows={supplier.purchaseOrders}
            rowKey={(r) => r.id}
            empty="No purchase orders issued to this supplier."
            columns={[
              {
                key: 'number',
                header: 'PO #',
                cell: (r) => (
                  <Link href={`/purchase/orders/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                    {r.number}
                  </Link>
                ),
              },
              {
                key: 'date',
                header: 'Date',
                cell: (r) => <span className="tabular text-xs">{new Date(r.orderDate).toLocaleDateString()}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (r) => (
                  <Pill
                    tone={
                      r.status === 'COMPLETED'
                        ? 'green'
                        : r.status === 'PARTIALLY_RECEIVED'
                          ? 'orange'
                          : r.status === 'APPROVED'
                            ? 'green'
                            : r.status === 'CANCELLED'
                              ? 'red'
                              : 'neutral'
                    }
                  >
                    {r.status.replace(/_/g, ' ').toLowerCase()}
                  </Pill>
                ),
              },
              {
                key: 'total',
                header: 'Total Value',
                align: 'right',
                cell: (r) => (
                  <span className="tabular font-medium">{formatCurrency(r.grandTotal, currency)}</span>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-0">
          <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
            <span>Recent Purchase Invoices</span>
            <span className="text-xs text-muted-foreground">{supplier.purchaseInvoices.length} Recent</span>
          </div>
          <DataTable
            rows={supplier.purchaseInvoices}
            rowKey={(r) => r.id}
            empty="No invoices recorded for this supplier."
            columns={[
              {
                key: 'number',
                header: 'Invoice #',
                cell: (r) => (
                  <Link href={`/purchase/invoices/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                    {r.number}
                  </Link>
                ),
              },
              {
                key: 'due',
                header: 'Due Date',
                cell: (r) => <span className="tabular text-xs">{new Date(r.dueDate).toLocaleDateString()}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (r) => (
                  <Pill
                    tone={
                      r.status === 'PAID'
                        ? 'green'
                        : r.status === 'PARTIALLY_PAID'
                          ? 'orange'
                          : r.status === 'CANCELLED'
                            ? 'red'
                            : 'neutral'
                    }
                  >
                    {r.status.replace(/_/g, ' ').toLowerCase()}
                  </Pill>
                ),
              },
              {
                key: 'total',
                header: 'Grand Total',
                align: 'right',
                cell: (r) => (
                  <span className="tabular">{formatCurrency(r.grandTotal, currency)}</span>
                ),
              },
              {
                key: 'dueAmt',
                header: 'Balance Due',
                align: 'right',
                cell: (r) => {
                  const rem = Math.max(0, Number(r.grandTotal) - Number(r.paidAmount));
                  return (
                    <span className={`tabular font-bold ${rem > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                      {formatCurrency(rem, currency)}
                    </span>
                  );
                },
              },
            ]}
          />
        </Card>

        <Card className="p-0">
          <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
            <span>Recent Payment Disbursements</span>
            <span className="text-xs text-muted-foreground">{supplier.payments.length} Recent</span>
          </div>
          <DataTable
            rows={supplier.payments}
            rowKey={(r) => r.id}
            empty="No payment vouchers recorded yet."
            columns={[
              {
                key: 'number',
                header: 'Voucher #',
                cell: (r) => <span className="font-mono text-xs font-semibold">{r.number}</span>,
              },
              {
                key: 'date',
                header: 'Date',
                cell: (r) => <span className="tabular text-xs">{new Date(r.paymentDate).toLocaleDateString()}</span>,
              },
              {
                key: 'method',
                header: 'Method',
                cell: (r) => (
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {r.method.replace(/_/g, ' ')}
                  </span>
                ),
              },
              {
                key: 'ref',
                header: 'Reference',
                cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.reference ?? '—'}</span>,
              },
              {
                key: 'amount',
                header: 'Amount Paid',
                align: 'right',
                cell: (r) => (
                  <span className="tabular font-bold text-emerald-600">
                    {formatCurrency(r.amount, currency)}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
