import { getSession } from '@/server/auth/session';
import { productService } from '@/server/services/product.service';
import { PageHeader } from '@/components/shared/page-header';
import { LabelSheet } from './label-sheet';

export const metadata = { title: 'Print labels' };

export default async function PrintLabelsPage() {
  const session = await getSession();
  const products = await productService.listForBarcodePrint(session);
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
          categoryName: p.category?.name ?? null,
          sellPrice: p.sellPrice.toString(),
        }))}
      />
    </div>
  );
}
