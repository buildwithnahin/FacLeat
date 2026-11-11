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
  const currency = supplier.currency as CurrencyCode;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/suppliers">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <PageHeader
        title={supplier.name}
        description={`${supplier.code} · ${supplier.branch.name}`}
      >
        <Button variant="outline" asChild>
          <Link href={`/suppliers/${supplier.id}/ledger`}>
            <BookOpen className="h-4 w-4" />
            Ledger
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/suppliers/${supplier.id}/pay`}>
            <CreditCard className="h-4 w-4" />
            Record Payment
          </Link>
        </Button>
        <Button variant="dark" asChild>
          <Link href={`/suppliers/${supplier.id}/edit`}>
            <Edit className="h-4 w-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Status"
          value={<Pill tone={supplier.status === 'ACTIVE' ? 'black' : supplier.status === 'BLOCKED' ? 'red' : 'grey'}>{supplier.status.toLowerCase()}</Pill>}
          description={supplier.paymentTerms.replace('_', ' ')}
        />
        <KpiCard
          label="Total Purchases"
          value={formatCurrency(totalPurchase ?? 0, currency)}
          description="Lifetime debit"
        />
        <KpiCard
          label="Outstanding Due"
          value={formatCurrency(dueAmount ?? 0, currency)}
          tone={dueAmount && d(dueAmount).gt(0) ? 'danger' : 'success'}
          description="Unpaid balance"
        />
        <KpiCard
          label="Payment Terms"
          value={supplier.paymentTerms.replace('_', ' ')}
          description={`Currency: ${currency}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-6 space-y-4 text-sm">
            <p className="text-sm font-semibold">Contact information</p>
            {supplier.contactPerson && (
              <div>
                <p className="text-xs text-muted-foreground">Contact person</p>
                <p>{supplier.contactPerson}</p>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{supplier.phone}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{supplier.email}</span>
              </div>
            )}
            {(supplier.address || supplier.city || supplier.country) && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>
                  {[supplier.address, supplier.city, supplier.country].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {supplier.taxId && (
              <div>
                <p className="text-xs text-muted-foreground">Tax / VAT ID</p>
                <p className="tabular">{supplier.taxId}</p>
              </div>
            )}
            {supplier.notes && (
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm">{supplier.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 p-0">
          <div className="px-4 py-3 border-b text-sm font-medium">Recent Purchase Orders</div>
          <DataTable
            rows={supplier.purchaseOrders}
            rowKey={(r) => r.id}
            empty="No purchase orders yet"
            columns={[
              { key: 'number', header: 'PO #', cell: (r) => (
                <Link href={`/purchase/orders/${r.id}`} className="text-blue-600 hover:underline tabular">
                  {r.number}
                </Link>
              ) },
              { key: 'date', header: 'Date', cell: (r) => new Date(r.orderDate).toLocaleDateString() },
              { key: 'status', header: 'Status', cell: (r) => (
                <Pill tone={
                  r.status === 'COMPLETED' ? 'green' :
                  r.status === 'PARTIALLY_RECEIVED' ? 'orange' :
                  r.status === 'APPROVED' ? 'green' :
                  r.status === 'CANCELLED' ? 'red' : 'amber'
                }>
                  {r.status.replace('_', ' ').toLowerCase()}
                </Pill>
              ) },
              { key: 'total', header: 'Total', align: 'right', cell: (r) => (
                <span className="tabular">{formatCurrency(r.grandTotal, currency)}</span>
              ) },
            ]}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-0">
          <div className="px-4 py-3 border-b text-sm font-medium">Recent Invoices</div>
          <DataTable
            rows={supplier.purchaseInvoices}
            rowKey={(r) => r.id}
            empty="No invoices yet"
            columns={[
              { key: 'number', header: 'Invoice #', cell: (r) => (
                <Link href={`/purchase/invoices/${r.id}`} className="text-blue-600 hover:underline tabular">
                  {r.number}
                </Link>
              ) },
              { key: 'due', header: 'Due', cell: (r) => new Date(r.dueDate).toLocaleDateString() },
              { key: 'status', header: 'Status', cell: (r) => (
                <Pill tone={
                  r.status === 'PAID' ? 'green' :
                  r.status === 'PARTIALLY_PAID' ? 'orange' :
                  r.status === 'CANCELLED' ? 'red' : 'amber'
                }>
                  {r.status.replace('_', ' ').toLowerCase()}
                </Pill>
              ) },
              { key: 'total', header: 'Total', align: 'right', cell: (r) => (
                <span className="tabular">{formatCurrency(r.grandTotal, currency)}</span>
              ) },
              { key: 'paid', header: 'Paid', align: 'right', cell: (r) => (
                <span className="tabular text-emerald-600">{formatCurrency(r.paidAmount, currency)}</span>
              ) },
            ]}
          />
        </Card>

        <Card className="p-0">
          <div className="px-4 py-3 border-b text-sm font-medium">Recent Payments</div>
          <DataTable
            rows={supplier.payments}
            rowKey={(r) => r.id}
            empty="No payments yet"
            columns={[
              { key: 'number', header: 'Payment #', cell: (r) => <span className="tabular">{r.number}</span> },
              { key: 'date', header: 'Date', cell: (r) => new Date(r.paymentDate).toLocaleDateString() },
              { key: 'method', header: 'Method', cell: (r) => r.method.replace('_', ' ').toLowerCase() },
              { key: 'ref', header: 'Reference', cell: (r) => <span className="tabular">{r.reference ?? '—'}</span> },
              { key: 'amount', header: 'Amount', align: 'right', cell: (r) => (
                <span className="tabular text-emerald-600">{formatCurrency(r.amount, currency)}</span>
              ) },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
