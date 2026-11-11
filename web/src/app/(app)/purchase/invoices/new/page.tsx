import { PageHeader } from '@/components/shared/page-header';
import { InvoiceForm } from '../_components/invoice-form';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import type { CurrencyCode } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New purchase invoice' };

interface PurchaseLookups {
  products: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    size: string | null;
    categoryName: string | null;
  }[];
}

interface OpenPurchaseOrder {
  id: string;
  number: string;
  status: string;
  supplier: { name: string };
}

interface PurchaseOrderWithItems {
  id: string;
  number: string;
  branchId: string;
  supplierId: string;
  currency: string;
  supplier: { name: string };
  items: {
    id: string;
    productId: string;
    product: { size: string | null };
    size: string | null;
    unit: string;
    orderedQty: string;
    unitPrice: string;
    taxRate: string;
  }[];
}

interface GrnWithItems {
  id: string;
  number: string;
  items: {
    productId: string;
    product: { size: string | null };
    purchaseOrderItemId: string;
    size: string | null;
    receivedQty: string;
    unitCost: string;
  }[];
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ purchaseOrderId?: string; grnId?: string }>;
}) {
  const sp = await searchParams;
  const { products } = await backendFetch<PurchaseLookups>('/api/mobile/purchase/lookups');

  if (!sp.purchaseOrderId) {
    // Without a PO we need supplier selection; simplest MVP: redirect to picking from POs.
    const pos = await backendFetch<OpenPurchaseOrder[]>(
      '/api/mobile/purchase/orders?statusIn=APPROVED,PARTIALLY_RECEIVED,COMPLETED',
    );
    return (
      <div className="space-y-6">
        <PageHeader
          title="Create Purchase Invoice"
          description="Pick a purchase order to bill against"
        />
        <ul className="space-y-2">
          {pos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No approved purchase orders available to invoice.
            </p>
          )}
          {pos.map((po) => (
            <li
              key={po.id}
              className="flex items-center justify-between border rounded-md p-3 bg-background"
            >
              <div>
                <p className="font-medium tabular">{po.number}</p>
                <p className="text-xs text-muted-foreground">
                  {po.supplier.name} · {po.status.replace('_', ' ').toLowerCase()}
                </p>
              </div>
              <a
                href={`/purchase/invoices/new?purchaseOrderId=${po.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Create invoice →
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  let po: PurchaseOrderWithItems;
  try {
    po = await backendFetch<PurchaseOrderWithItems>(`/api/mobile/purchase/orders/${sp.purchaseOrderId}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) {
      return <p className="text-sm text-muted-foreground">Purchase order not found.</p>;
    }
    throw e;
  }

  const grn = sp.grnId
    ? await backendFetch<GrnWithItems>(`/api/mobile/purchase/grn/${sp.grnId}`)
    : null;

  const prefillItems = grn
    ? grn.items.map((i) => {
        const poItem = po.items.find((p) => p.id === i.purchaseOrderItemId);
        return {
          productId: i.productId,
          size: i.size ?? i.product.size ?? '',
          description: '',
          unit: poItem?.unit ?? 'PCS',
          quantity: i.receivedQty,
          unitPrice: i.unitCost,
          taxRate: poItem?.taxRate ?? '0',
        };
      })
    : po.items.map((i) => ({
        productId: i.productId,
        size: i.size ?? i.product.size ?? '',
        description: '',
        unit: i.unit,
        quantity: i.orderedQty,
        unitPrice: i.unitPrice,
        taxRate: i.taxRate,
      }));

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Create Purchase Invoice"
        description={`${po.supplier.name} · PO ${po.number}${grn ? ` · GRN ${grn.number}` : ''}`}
      />
      <InvoiceForm
        branchId={po.branchId}
        supplierId={po.supplierId}
        supplierName={po.supplier.name}
        purchaseOrderId={po.id}
        purchaseOrderNumber={po.number}
        grnId={grn?.id}
        grnNumber={grn?.number}
        currency={po.currency as CurrencyCode}
        prefillItems={prefillItems}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          size: product.size,
          categoryName: product.categoryName,
        }))}
      />
    </div>
  );
}
