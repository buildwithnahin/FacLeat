import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { nextProductionNumber } from '@/lib/document-number';

export async function autoCreateProductionOrderForPlan(
  planId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
  actorUserId?: string,
) {
  const plan = await tx.productionPlan.findUnique({
    where: { id: planId },
    include: {
      product: { select: { id: true, unit: true, name: true, sku: true } },
      orders: { select: { id: true } },
    },
  });
  if (!plan) return null;
  if (plan.orders.length > 0) return plan.orders[0];

  const year = plan.plannedStartDate
    ? new Date(plan.plannedStartDate).getFullYear()
    : new Date().getFullYear();
  const count = await tx.productionOrder.count({
    where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
  });
  const number = nextProductionNumber(year, count);

  const notesList = [
    plan.productionLine ? `Line: ${plan.productionLine}` : null,
    plan.shift ? `Shift: ${plan.shift}` : null,
    plan.machine ? `Machine: ${plan.machine}` : null,
    plan.priority ? `Priority: ${plan.priority}` : null,
  ].filter(Boolean);

  const order = await tx.productionOrder.create({
    data: {
      branchId: plan.branchId,
      number,
      productId: plan.productId,
      planId: plan.id,
      plannedQty: plan.quantity,
      unit: (plan.product.unit as any) ?? 'PCS',
      status: 'PLANNED',
      plannedStartDate: plan.plannedStartDate,
      plannedEndDate: plan.plannedEndDate,
      notes: notesList.length > 0 ? notesList.join(' · ') : `From Plan ${plan.planNo}`,
      createdById: actorUserId || plan.plannerId || null,
      stages: {
        create: [
          { sequence: 1, name: 'Cutting', notes: null },
          { sequence: 2, name: 'Stitching', notes: null },
          { sequence: 3, name: 'Finishing', notes: null },
        ],
      },
    },
  });

  return order;
}
