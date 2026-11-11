import 'server-only';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { branchService } from '@/server/services/branch.service';
import type { AppSession } from '@/server/auth/session';

export const lookupMethods = {
  /**
   * Backs the branch/product/warehouse pickers on the purchase "new" pages
   * (requisition, PO, GRN, invoice, debit-note). Before the backend/web
   * split these were raw `prisma.*.findMany` calls inside each page
   * component; centralized here behind `purchase:read` so every form
   * shares one lookup instead of each page re-querying ad hoc.
   */
  async purchaseLookups(session: AppSession | null, filters: { branchId?: string } = {}) {
    await authorize(session, 'purchase:read');

    const [branches, products, warehouses] = await Promise.all([
      branchService.listAccessible(session),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { sku: 'asc' },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          size: true,
          costPrice: true,
          category: { select: { name: true } },
        },
      }),
      prisma.warehouse.findMany({
        where: { isActive: true, branchId: filters.branchId || undefined },
        orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
        select: { id: true, code: true, name: true, branchId: true },
      }),
    ]);

    return {
      branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code, currency: b.currency })),
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        size: p.size,
        costPrice: p.costPrice,
        categoryName: p.category?.name ?? null,
      })),
      warehouses,
    };
  },
};
