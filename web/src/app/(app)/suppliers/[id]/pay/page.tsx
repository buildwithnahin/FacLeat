import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { PaymentForm } from './payment-form';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

interface SupplierLite {
  id: string;
  code: string;
  name: string;
  currency: string;
  dueAmount: string;
}

interface OpenInvoice {
  id: string;
  number: string;
  grandTotal: string;
  paidAmount: string;
  dueDate: string;
}

export default async function SupplierPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let supplier: SupplierLite;
  try {
    supplier = await backendFetch<SupplierLite>(`/api/mobile/suppliers/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  const openInvoices = await backendFetch<OpenInvoice[]>(`/api/mobile/suppliers/${id}/open-invoices`);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/suppliers/${supplier.id}`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Supplier
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Record Supplier Payment"
        description={`${supplier.name} (${supplier.code}) · Issue payment voucher and update supplier ledger`}
      />

      <PaymentForm
        supplierId={supplier.id}
        supplierName={supplier.name}
        currency={supplier.currency || 'BDT'}
        totalDue={supplier.dueAmount || '0'}
        openInvoices={openInvoices.map((i) => ({
          id: i.id,
          number: i.number,
          grandTotal: i.grandTotal,
          paidAmount: i.paidAmount,
          dueDate: i.dueDate,
        }))}
      />
    </div>
  );
}
