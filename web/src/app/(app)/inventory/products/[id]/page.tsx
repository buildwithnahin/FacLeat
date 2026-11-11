import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { ProductForm } from '../product-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit product' };

interface ProductDetail {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  size: string | null;
  type: 'RAW_MATERIAL' | 'WORK_IN_PROGRESS' | 'FINISHED_GOOD' | 'CONSUMABLE' | 'SERVICE';
  unit: 'PCS' | 'KG' | 'G' | 'M' | 'M2' | 'L' | 'ML' | 'BOX' | 'PACK' | 'PAIR' | 'SET';
  categoryId: string | null;
  brandId: string | null;
  costPrice: string;
  sellPrice: string;
  taxRate: string;
  reorderLevel: string;
  reorderQty: string;
  isActive: boolean;
  imageUrl: string | null;
}

interface CategoryFlat {
  id: string;
  name: string;
}

interface BrandOption {
  id: string;
  name: string;
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getSession();
  const [product, categories, brands] = await Promise.all([
    backendFetch<ProductDetail>(`/api/mobile/inventory/products/${id}`),
    backendFetch<CategoryFlat[]>('/api/mobile/inventory/categories?flat=true'),
    backendFetch<BrandOption[]>('/api/mobile/inventory/brands'),
  ]);

  return (
    <div>
      <PageHeader title={product.name} description={`SKU ${product.sku}`} />
      <ProductForm
        mode="edit"
        initial={{
          id: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          description: product.description,
          size: product.size,
          type: product.type,
          unit: product.unit,
          categoryId: product.categoryId,
          brandId: product.brandId,
          costPrice: product.costPrice,
          sellPrice: product.sellPrice,
          taxRate: product.taxRate,
          reorderLevel: product.reorderLevel,
          reorderQty: product.reorderQty,
          isActive: product.isActive,
          imageUrl: product.imageUrl,
        }}
        categories={categories}
        brands={brands}
      />
    </div>
  );
}
