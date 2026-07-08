import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { getSession } from '@/server/auth/session';
import { productService } from '@/server/services/product.service';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import {
  INVENTORY_SECTION_META,
  INVENTORY_SECTION_SLUGS,
  parseInventorySection,
} from '@/lib/inventory-sections';
import { ProductsBrowser, type ProductRow } from './products-browser';

export const metadata = { title: 'Products' };

type ProductsPageProps = {
  searchParams: Promise<{ section?: string }>;
};

function sectionToProductType(
  section: ReturnType<typeof parseInventorySection>,
): Prisma.ProductWhereInput['type'] {
  switch (section) {
    case 'raw-material':
      return 'RAW_MATERIAL';
    case 'work-in-progress':
      return 'WORK_IN_PROGRESS';
    case 'finished-goods':
      return 'FINISHED_GOOD';
    case 'consumables':
      return { in: ['CONSUMABLE', 'SERVICE'] };
    default:
      return undefined;
  }
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const session = await getSession();
  const sp = await searchParams;
  const section = parseInventorySection(sp.section) ?? 'raw-material';
  const products = await productService.list(session, {
    type: sectionToProductType(section),
  });
  const canWrite = session?.permissions.includes('inventory:write') ?? false;
  const sectionMeta = INVENTORY_SECTION_META[section];

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    unit: p.unit,
    costPrice: p.costPrice.toString(),
    sellPrice: p.sellPrice.toString(),
    reorderLevel: p.reorderLevel.toString(),
    availableQty: p.availableQty.toString(),
    isActive: p.isActive,
    category: p.category ? { id: p.category.id, name: p.category.name } : null,
  }));

  return (
    <div>
      <PageHeader
        title={`${sectionMeta.label} Products`}
        description={`${sectionMeta.description} This product list is filtered to ${sectionMeta.label.toLowerCase()} SKUs.`}
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
