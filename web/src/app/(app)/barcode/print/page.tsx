import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { LabelSheet } from './label-sheet';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Print labels' };

interface PrintProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  size: string | null;
  unit: string;
  category: { name: string } | null;
  sellPrice: string;
}

export default async function PrintLabelsPage() {
  const products = await backendFetch<PrintProduct[]>('/api/mobile/barcode/products/print');
  return (
    <div>
      <PageHeader
        title="Print labels"
        description="Pick quantities per SKU, then print machine-readable barcode labels on a 3-column A4 sheet."
      />
      <LabelSheet
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          barcode: p.barcode,
          size: p.size,
          unit: p.unit,
          categoryName: p.category?.name ?? null,
          sellPrice: p.sellPrice.toString(),
        }))}
      />
    </div>
  );
}
