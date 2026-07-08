import { PageHeader } from '@/components/shared/page-header';
import { prisma } from '@/server/db';
import { ProductionOrderForm } from '../production-order-form';

export const metadata = { title: 'New production order' };

export default async function NewProductionOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>;
}) {
  const sp = await searchParams;
  const [branches, products, warehouses, plan] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, sku: true, name: true, unit: true, type: true },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, branchId: true },
    }),
    sp.planId
      ? prisma.productionPlan.findUnique({ where: { id: sp.planId } })
      : Promise.resolve(null),
  ]);

  const prefill =
    plan && (plan.status === 'APPROVED' || plan.status === 'SCHEDULED')
      ? {
          planId: plan.id,
          branchId: plan.branchId,
          productId: plan.productId,
          plannedQty: plan.quantity.toString(),
          plannedStartDate: plan.plannedStartDate.toISOString().slice(0, 10),
          plannedEndDate: plan.plannedEndDate.toISOString().slice(0, 10),
        }
      : undefined;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="New Production Order"
        description={
          prefill ? `From plan ${plan?.planNo}` : 'Plan a production run — set target output, materials, and stages'
        }
      />
      <ProductionOrderForm branches={branches} products={products} warehouses={warehouses} prefill={prefill} />
    </div>
  );
}
