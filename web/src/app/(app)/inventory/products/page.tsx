import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import {
  INVENTORY_SECTION_META,
  INVENTORY_SECTION_SLUGS,
  parseInventorySection,
} from '@/lib/inventory-sections';
import { ProductsBrowser, type ProductRow } from './products-browser';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Products' };

type ProductsPageProps = {
  searchParams: Promise<{ section?: string }>;
};

interface ProductApiRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  costPrice: string;
  sellPrice: string;
  reorderLevel: string;
  availableQty: string;
  isActive: boolean;
  category: { id: string; name: string } | null;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const session = await getSession();
  const sp = await searchParams;
  const section = parseInventorySection(sp.section);
  const qs = section ? `?section=${section}` : '';
  const products = await backendFetch<ProductApiRow[]>(`/api/mobile/inventory/products${qs}`);
  const canWrite = session?.permissions.includes('inventory:write') ?? false;
  const pageTitle = section ? `${INVENTORY_SECTION_META[section].label} Products` : 'All Products';
  const pageDescription = section
    ? `${INVENTORY_SECTION_META[section].description} This product list is filtered to ${INVENTORY_SECTION_META[section].label.toLowerCase()} SKUs.`
    : 'Complete catalog of products across all production stages and categories.';

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    unit: p.unit,
    costPrice: p.costPrice,
    sellPrice: p.sellPrice,
    reorderLevel: p.reorderLevel,
    availableQty: p.availableQty,
    isActive: p.isActive,
    category: p.category ? { id: p.category.id, name: p.category.name } : null,
  }));

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
      >
        {canWrite && (
          <Button asChild>
            <Link href="/inventory/products/new">
              <Plus className="h-4 w-4" />
              New product
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={!section ? 'default' : 'outline'} asChild>
          <Link href="/inventory/products">All Products</Link>
        </Button>
        {INVENTORY_SECTION_SLUGS.map((slug) => (
          <Button key={slug} variant={section === slug ? 'default' : 'outline'} asChild>
            <Link href={`/inventory/products?section=${slug}`}>{INVENTORY_SECTION_META[slug].label}</Link>
          </Button>
        ))}
      </div>

      <ProductsBrowser products={rows} canWrite={canWrite} />
    </div>
  );
}
