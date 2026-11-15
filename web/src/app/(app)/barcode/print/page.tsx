import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';
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
  availableQty?: string;
}

interface SearchParams {
  branchId?: string;
  companyId?: string;
}

export default async function PrintLabelsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const [session, sp] = await Promise.all([
    getSession(),
    searchParams ? await searchParams : ({} as SearchParams),
  ]);

  const activeCompanyId = sp.companyId || session?.activeCompanyId || session?.defaultCompanyId || undefined;
  const activeBranchId = sp.branchId || session?.activeBranchId || session?.defaultBranchId || undefined;

  const qs = new URLSearchParams();
  if (activeCompanyId && activeCompanyId !== 'ALL') qs.set('companyId', activeCompanyId);
  if (activeBranchId && activeBranchId !== 'ALL') qs.set('branchId', activeBranchId);

  const products = await backendFetch<PrintProduct[]>(
    `/api/mobile/barcode/products/print${qs.toString() ? `?${qs.toString()}` : ''}`,
  );

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
