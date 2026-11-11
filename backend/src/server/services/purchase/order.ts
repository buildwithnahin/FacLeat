import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { approvalService } from '@/server/services/approval.service';
import { getScopedBranchIds } from '@/server/auth/scope';
import type { AppSession } from '@/server/auth/session';
import type { PurchaseOrderCreateInput } from '@/server/validators/purchase';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { nextDocumentNumber } from '@/lib/document-number';
import { computeLineTotal, isShoesCategory, normalizeSize } from './shared';

export const orderMethods = {
  async listPurchaseOrders(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; supplierId?: string; search?: string } = {},
  ) {
    await authorize(session, 'purchase:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    const search = filters.search?.trim();
    return prisma.purchaseOrder.findMany({
      where: {
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        status: filters.status as
          | 'DRAFT'
          | 'PENDING'
          | 'APPROVED'
          | 'PARTIALLY_RECEIVED'
          | 'COMPLETED'
          | 'CANCELLED'
          | undefined,
        supplierId: filters.supplierId,
        ...(search
          ? {
              OR: [
                { number: { contains: search } },
                { supplier: { name: { contains: search } } },
                { supplier: { code: { contains: search } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        requisition: { select: { id: true, number: true } },
        items: { select: { id: true } },
      },
    });
  },

  async getPurchaseOrder(session: AppSession | null, id: string) {
    await authorize(session, 'purchase:read');
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, currency: true } },
        supplier: true,
        requisition: { select: { id: true, number: true } },
        items: {
          include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
        },
        grns: { orderBy: { createdAt: 'desc' } },
        invoices: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!po) throw new NotFoundError('Purchase order not found');
    return po;
  },

  async createPurchaseOrder(session: AppSession | null, input: PurchaseOrderCreateInput) {
    const actor = await authorize(session, 'purchase:write');

    const productIds = [...new Set(input.items.map((it) => it.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, category: { select: { name: true } }, size: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    const department = input.requisitionId
      ? (
          await prisma.purchaseRequisition.findUnique({
            where: { id: input.requisitionId },
            select: { department: true },
          })
        )?.department ?? null
      : null;

    return prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const yearCount = await tx.purchaseOrder.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const number = nextDocumentNumber('PO', year, yearCount);

      let subtotal = new Prisma.Decimal(0);
      let taxTotal = new Prisma.Decimal(0);
      let discountTotal = new Prisma.Decimal(0);
      const itemRows = input.items.map((it) => {
        const product = productById.get(it.productId);
        if (!product) throw new ValidationError('Selected product was not found');
        const size = normalizeSize(it.size) ?? product.size;
        if (isShoesCategory(product.category?.name) && !size) {
          throw new ValidationError('Size is required for shoes in purchase orders');
        }
        const qty = new Prisma.Decimal(it.orderedQty);
        const price = new Prisma.Decimal(it.unitPrice);
        const tax = new Prisma.Decimal(it.taxRate);
        const disc = new Prisma.Decimal(it.discountRate);
        const totals = computeLineTotal(qty, price, tax, disc);
        subtotal = subtotal.plus(totals.gross);
        taxTotal = taxTotal.plus(totals.tax);
        discountTotal = discountTotal.plus(totals.discount);
        return {
          productId: it.productId,
          accountCategory: it.accountCategory,
          size,
          description: it.description || null,
          unit: it.unit,
          orderedQty: qty,
          receivedQty: new Prisma.Decimal(0),
          unitPrice: price,
          taxRate: tax,
          discountRate: disc,
          lineTotal: totals.total,
        };
      });
      const grandTotal = subtotal.minus(discountTotal).plus(taxTotal);

      const po = await tx.purchaseOrder.create({
        data: {
          branchId: input.branchId,
          number,
          supplierId: input.supplierId,
          requisitionId: input.requisitionId || null,
          department,
          status: 'PENDING',
          orderDate: input.orderDate ?? new Date(),
          deliveryDate: input.deliveryDate,
          currency: input.currency,
          subtotal,
          taxTotal,
          discountTotal,
          grandTotal,
          notes: input.notes || null,
          createdById: actor.userId,
          items: { create: itemRows },
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: po.branchId,
          module: 'purchase',
          action: 'po.create',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          after: {
            number,
            supplierId: po.supplierId,
            grandTotal: grandTotal.toString(),
            itemCount: itemRows.length,
          },
        },
        tx,
      );

      return po;
    });
  },

  async approvePurchaseOrder(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'purchase:approve');
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Purchase order not found');
    if (existing.status !== 'PENDING' && existing.status !== 'DRAFT') {
      throw new ValidationError(`Cannot approve PO in ${existing.status} state`);
    }
    await approvalService.ensureApprovedOrRequest(session, {
      module: 'purchase',
      action: 'approve',
      entityType: 'PurchaseOrder',
      entityId: existing.id,
      title: `Purchase order ${existing.number}`,
      summary: `Approval required before confirming PO ${existing.number}`,
      amount: existing.grandTotal.toNumber(),
      currency: existing.currency,
      branchId: existing.branchId,
    });
    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: actor.userId,
          approvedAt: new Date(),
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: po.branchId,
          module: 'purchase',
          action: 'po.approve',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          before: { status: existing.status },
          after: { status: po.status },
        },
        tx,
      );
      return po;
    });
  },

  async cancelPurchaseOrder(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'purchase:write');
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Purchase order not found');
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new ValidationError(`Cannot cancel PO in ${existing.status} state`);
    }
    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: po.branchId,
          module: 'purchase',
          action: 'po.cancel',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          before: { status: existing.status },
        },
        tx,
      );
      return po;
    });
  },
};
