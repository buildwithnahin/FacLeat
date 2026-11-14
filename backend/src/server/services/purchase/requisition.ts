import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import { approvalService } from '@/server/services/approval.service';
import { getScopedBranchIds } from '@/server/auth/data-scope';
import type { AppSession } from '@/server/auth/session';
import type {
  RequisitionCreateInput,
  RequisitionDecisionInput,
} from '@/server/validators/purchase';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { nextDocumentNumber } from '@/lib/document-number';

export const requisitionMethods = {
  async listRequisitions(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; search?: string } = {},
  ) {
    await authorize(session, 'purchase:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    const search = filters.search?.trim();
    return prisma.purchaseRequisition.findMany({
      where: {
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        status: filters.status as
          | 'DRAFT'
          | 'PENDING'
          | 'APPROVED'
          | 'REJECTED'
          | 'CANCELLED'
          | 'CLOSED'
          | undefined,
        ...(search
          ? {
              OR: [
                { number: { contains: search } },
                { department: { contains: search } },
                { requestedBy: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { select: { id: true } },
      },
    });
  },

  async getRequisition(session: AppSession | null, id: string) {
    await authorize(session, 'purchase:read');
    const pr = await prisma.purchaseRequisition.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, currency: true } },
        items: {
          include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
        },
        purchaseOrders: { select: { id: true, number: true, status: true } },
      },
    });
    if (!pr) throw new NotFoundError('Requisition not found');
    return pr;
  },

  async createRequisition(session: AppSession | null, input: RequisitionCreateInput) {
    const actor = await authorize(session, 'purchase:write');

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, input.branchId, input.requiredDate);

      const year = new Date().getFullYear();
      const yearCount = await tx.purchaseRequisition.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const number = nextDocumentNumber('PR', year, yearCount);

      const pr = await tx.purchaseRequisition.create({
        data: {
          branchId: input.branchId,
          number,
          department: input.department,
          requestedBy: input.requestedBy,
          priority: input.priority,
          status: 'PENDING',
          requiredDate: input.requiredDate,
          notes: input.notes || null,
          createdById: actor.userId,
          items: {
            create: input.items.map((it) => ({
              productId: it.productId || null,
              productName: it.productName,
              unit: it.unit,
              quantity: new Prisma.Decimal(it.quantity),
              estimatedPrice: new Prisma.Decimal(it.estimatedPrice),
              note: it.note || null,
            })),
          },
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: pr.branchId,
          module: 'purchase',
          action: 'requisition.create',
          entityType: 'PurchaseRequisition',
          entityId: pr.id,
          after: {
            number,
            department: pr.department,
            priority: pr.priority,
            itemCount: input.items.length,
          },
        },
        tx,
      );

      return pr;
    });
  },

  async decideRequisition(session: AppSession | null, input: RequisitionDecisionInput) {
    const actor = await authorize(
      session,
      input.decision === 'APPROVE' ? 'purchase:approve' : 'purchase:write',
    );
    const existing = await prisma.purchaseRequisition.findUnique({
      where: { id: input.id },
      include: {
        items: { select: { quantity: true, estimatedPrice: true } },
        branch: { select: { currency: true } },
      },
    });
    if (!existing) throw new NotFoundError('Requisition not found');
    if (existing.status !== 'PENDING' && existing.status !== 'DRAFT') {
      throw new ValidationError(
        `Cannot ${input.decision.toLowerCase()} requisition in ${existing.status} state`,
      );
    }

    if (input.decision === 'APPROVE') {
      const amount = existing.items.reduce(
        (sum, it) => sum.plus(it.quantity.mul(it.estimatedPrice)),
        new Prisma.Decimal(0),
      );
      await approvalService.ensureApprovedOrRequest(session, {
        module: 'purchase',
        action: 'requisition-approve',
        entityType: 'PurchaseRequisition',
        entityId: existing.id,
        title: `Purchase requisition ${existing.number}`,
        summary: `Approval required before approving PR ${existing.number}`,
        amount: amount.toNumber(),
        currency: existing.branch.currency,
        branchId: existing.branchId,
      });
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseRequisition.update({
        where: { id: input.id },
        data:
          input.decision === 'APPROVE'
            ? {
                status: 'APPROVED',
                approvedById: actor.userId,
                approvedAt: new Date(),
                rejectedReason: null,
              }
            : {
                status: 'REJECTED',
                approvedById: actor.userId,
                approvedAt: new Date(),
                rejectedReason: input.reason || 'Rejected',
              },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: updated.branchId,
          module: 'purchase',
          action: `requisition.${input.decision.toLowerCase()}`,
          entityType: 'PurchaseRequisition',
          entityId: updated.id,
          before: { status: existing.status },
          after: { status: updated.status, reason: input.reason ?? null },
        },
        tx,
      );
      return updated;
    });
  },
};
