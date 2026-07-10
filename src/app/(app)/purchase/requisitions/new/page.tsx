import { PageHeader } from '@/components/shared/page-header';
import { RequisitionForm } from '../_components/requisition-form';
import { prisma } from '@/server/db';

export const metadata = { title: 'New Purchase Requisition' };

export default async function NewRequisitionPage() {
  const [branches, products] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Create Purchase Requisition"
        description="Raise a PR for approval before converting it to a PO"
      />
      <RequisitionForm
        branches={branches}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
        }))}
      />
    </div>
  );
}
