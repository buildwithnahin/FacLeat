import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import type { AppSession } from '@/server/auth/session';

export const dashboardMethods = {
  async dashboardSummary(session: AppSession | null) {
    await authorize(session, 'purchase:read');
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayAgg, monthAgg, activePOs, pendingPR, pendingPO, pendingGRN, payableAgg] =
      await Promise.all([
        prisma.purchaseOrder.aggregate({
          _sum: { grandTotal: true },
          where: { orderDate: { gte: todayStart } },
        }),
        prisma.purchaseOrder.aggregate({
          _sum: { grandTotal: true },
          where: { orderDate: { gte: monthStart } },
        }),
        prisma.purchaseOrder.count({
          where: { status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } },
        }),
        prisma.purchaseRequisition.count({ where: { status: 'PENDING' } }),
        prisma.purchaseOrder.count({ where: { status: 'PENDING' } }),
        prisma.purchaseOrder.count({
          where: { status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } },
        }),
        prisma.$queryRaw<{ total: number }[]>`SELECT COALESCE(SUM(debit - credit), 0)::numeric AS total FROM "SupplierLedger"`,
      ]);

    return {
      todayTotal: todayAgg._sum.grandTotal ?? new Prisma.Decimal(0),
      monthTotal: monthAgg._sum.grandTotal ?? new Prisma.Decimal(0),
      activePOs,
      pendingPR,
      pendingPO,
      pendingGRN,
      totalPayable: new Prisma.Decimal(payableAgg[0]?.total ?? 0),
    };
  },
};
