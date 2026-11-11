import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { getScopedBranchIds } from '@/server/auth/scope';
import type { AppSession } from '@/server/auth/session';

export const dashboardMethods = {
  async dashboardSummary(session: AppSession | null, filters: { branchId?: string } = {}) {
    await authorize(session, 'purchase:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    const branchFilter = branchIds ? { branchId: { in: branchIds } } : {};

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayAgg, monthAgg, activePOs, pendingPR, pendingPO, pendingGRN, payableAgg] =
      await Promise.all([
        prisma.purchaseOrder.aggregate({
          _sum: { grandTotal: true },
          where: { ...branchFilter, orderDate: { gte: todayStart } },
        }),
        prisma.purchaseOrder.aggregate({
          _sum: { grandTotal: true },
          where: { ...branchFilter, orderDate: { gte: monthStart } },
        }),
        prisma.purchaseOrder.count({
          where: { ...branchFilter, status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } },
        }),
        prisma.purchaseRequisition.count({ where: { ...branchFilter, status: 'PENDING' } }),
        prisma.purchaseOrder.count({ where: { ...branchFilter, status: 'PENDING' } }),
        prisma.purchaseOrder.count({
          where: { ...branchFilter, status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } },
        }),
        prisma.supplierLedger.aggregate({
          _sum: { debit: true, credit: true },
          where: branchFilter,
        }),
      ]);

    const totalPayable = (payableAgg._sum.debit ?? new Prisma.Decimal(0)).minus(
      payableAgg._sum.credit ?? new Prisma.Decimal(0),
    );

    return {
      todayTotal: todayAgg._sum.grandTotal ?? new Prisma.Decimal(0),
      monthTotal: monthAgg._sum.grandTotal ?? new Prisma.Decimal(0),
      activePOs,
      pendingPR,
      pendingPO,
      pendingGRN,
      totalPayable,
    };
  },
};
