import { PageHeader } from '@/components/shared/page-header';
import { prisma } from '@/server/db';
import { ProductionPlanForm } from '../plan-form';

export const metadata = { title: 'New production plan' };

export default async function NewProductionPlanPage() {
  const [branches, products] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, type: { in: ['FINISHED_GOOD', 'WORK_IN_PROGRESS'] } },
      orderBy: { name: 'asc' },
      select: { id: true, sku: true, name: true, unit: true },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="New Production Plan"
        description="Plan a run ahead of committing to a production order"
      />
      <ProductionPlanForm branches={branches} products={products} />
    </div>
  );
}
