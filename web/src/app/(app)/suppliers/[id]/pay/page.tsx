import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { PaymentForm } from './payment-form';
import { backendFetch, BackendApiError } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

interface SupplierLite {
  id: string;
  code: string;
  name: string;
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
      <PageHeader
        title="Record Payment"
        description={`${supplier.name} (${supplier.code})`}
      />
      <PaymentForm
        supplierId={supplier.id}
        supplierName={supplier.name}
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
