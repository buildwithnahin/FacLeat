import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { publishNotification, publishToPermission } from '@/server/notifications/publisher';
import type { AppSession } from '@/server/auth/session';
import type {
  ApprovalRuleInput,
  ApprovalSubmitInput,
  ApprovalDecisionInput,
} from '@/server/validators/approvals';
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors';

const REQUEST_INCLUDE = {
  rule: {
    select: {
      id: true,
      name: true,
      escalateAfterHours: true,
      approvers: { orderBy: { sequence: 'asc' }, select: { role: true } },
    },
  },
  steps: { orderBy: { sequence: 'asc' } },
} satisfies Prisma.ApprovalRequestInclude;

/**
 * MySQL has no scalar array type, so `ApprovalRule.approverRoles` is now an
 * ordered join table (`approvers`, one row per role, ordered by `sequence`).
 * Reshape back to a flat `approverRoles: string[]` on every read so the API
 * contract (consumed by web/ and mobile/) is unchanged.
 */
function withApproverRoles<T extends { approvers: { role: string }[] }>(rule: T) {
  const { approvers, ...rest } = rule;
  return { ...rest, approverRoles: approvers.map((a) => a.role) };
}

function reshapeRequestRule<T extends { rule: { approvers: { role: string }[] } | null }>(
  req: T,
) {
  if (!req.rule) return req;
  return { ...req, rule: withApproverRoles(req.rule) };
}

/**
 * `ApprovalRequest.requestedById` has no Prisma relation (plain FK-by-
 * convention, not a declared `@relation`), so it can't go in `include` —
 * batch-fetch requester names/emails separately and attach as
 * `requestedBy` so consumers (web + mobile) don't have to show a raw
 * user id where a human name is expected.
 */
async function attachRequesters<T extends { requestedById: string }>(
  requests: T[],
): Promise<(T & { requestedBy: { id: string; name: string; email: string } | null })[]> {
  const ids = [...new Set(requests.map((r) => r.requestedById))];
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return requests.map((r) => ({ ...r, requestedBy: byId.get(r.requestedById) ?? null }));
}

async function findMatchingRule(module: string, action: string, amount: number) {
  return prisma.approvalRule.findFirst({
    where: {
      module,
      action,
      isActive: true,
      minAmount: { lte: new Prisma.Decimal(amount) },
    },
    orderBy: { minAmount: 'desc' },
    include: { approvers: { orderBy: { sequence: 'asc' } } },
  });
}

async function notifyRole(
  roleName: string,
  payload: { title: string; body: string; href?: string; module: string },
) {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', roles: { some: { role: { name: roleName } } } },
    select: { id: true },
  });
  for (const u of users) {
    await publishNotification({
      recipientId: u.id,
      severity: 'INFO',
      module: payload.module,
      title: payload.title,
      body: payload.body,
      href: payload.href,
    });
  }
}

async function syncEmployeeTransferApprovalState(
  args: {
    approvalStatus: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'CANCELLED';
    transferId: string;
    actorUserId: string;
    note?: string | null;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const now = new Date();

  if (args.approvalStatus === 'APPROVED') {
    await tx.employeeTransfer.update({
      where: { id: args.transferId },
      data: {
        status: 'APPROVED',
        approvedAt: now,
        approvedById: args.actorUserId,
        rejectionReason: null,
      },
    });
    return;
  }

  if (args.approvalStatus === 'REJECTED') {
    await tx.employeeTransfer.update({
      where: { id: args.transferId },
      data: {
        status: 'REJECTED',
        rejectedAt: now,
        rejectedById: args.actorUserId,
        rejectionReason: args.note || null,
      },
    });
    return;
  }

  await tx.employeeTransfer.update({
    where: { id: args.transferId },
    data: {
      status: 'DRAFT',
      updatedById: args.actorUserId,
    },
  });
}

/**
 * PurchaseOrder and PurchaseInvoice have no dedicated "rejected" status —
 * reusing CANCELLED on rejection is a deliberate modeling compromise, not an oversight.
 */
async function syncPurchaseApprovalState(
  args: {
    approvalStatus: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
    entityType: 'PurchaseRequisition' | 'PurchaseOrder' | 'PurchaseInvoice';
    entityId: string;
    actorUserId: string;
    note?: string | null;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (args.approvalStatus === 'CHANGES_REQUESTED') return;
  const now = new Date();
  const approved = args.approvalStatus === 'APPROVED';

  if (args.entityType === 'PurchaseRequisition') {
    await tx.purchaseRequisition.update({
      where: { id: args.entityId },
      data: approved
        ? { status: 'APPROVED', approvedById: args.actorUserId, approvedAt: now, rejectedReason: null }
        : {
            status: 'REJECTED',
            approvedById: args.actorUserId,
            approvedAt: now,
            rejectedReason: args.note || 'Rejected',
          },
    });
    return;
  }

  if (args.entityType === 'PurchaseOrder') {
    await tx.purchaseOrder.update({
      where: { id: args.entityId },
      data: approved
        ? { status: 'APPROVED', approvedById: args.actorUserId, approvedAt: now }
        : { status: 'CANCELLED' },
    });
    return;
  }

  await tx.purchaseInvoice.update({
    where: { id: args.entityId },
    data: { status: approved ? 'PENDING' : 'CANCELLED' },
  });
}

async function syncProductionPlanApprovalState(
  args: {
    approvalStatus: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
    planId: string;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (args.approvalStatus === 'CHANGES_REQUESTED') return;
  await tx.productionPlan.update({
    where: { id: args.planId },
    data: { status: args.approvalStatus === 'APPROVED' ? 'APPROVED' : 'CANCELLED' },
  });
}

export const approvalService = {
  async listRules(session: AppSession | null) {
    await authorize(session, 'approvals:read');
    const rules = await prisma.approvalRule.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }, { minAmount: 'asc' }],
      include: { approvers: { orderBy: { sequence: 'asc' } } },
    });
    return rules.map(withApproverRoles);
  },

  async upsertRule(session: AppSession | null, input: ApprovalRuleInput, id?: string) {
    const actor = await authorize(session, 'approvals:configure');
    const data = {
      name: input.name,
      module: input.module,
      action: input.action,
      minAmount: new Prisma.Decimal(input.minAmount),
      escalateAfterHours: input.escalateAfterHours,
      isActive: input.isActive,
      description: input.description || null,
      // Ordered join rows replace the old `approverRoles String[]` column
      // (MySQL has no scalar array type). On update, drop and recreate the
      // full ordered set rather than diffing — the rule's approver list is
      // small and always submitted in full from the form.
      approvers: {
        ...(id ? { deleteMany: {} } : {}),
        create: input.approverRoles.map((role, i) => ({ role, sequence: i + 1 })),
      },
    };
    const rule = id
      ? await prisma.approvalRule.update({
          where: { id },
          data,
          include: { approvers: { orderBy: { sequence: 'asc' } } },
        })
      : await prisma.approvalRule.create({
          data,
          include: { approvers: { orderBy: { sequence: 'asc' } } },
        });
    await recordAudit({
      actorId: actor.userId,
      branchId: null,
      module: 'approvals',
      action: id ? 'update-rule' : 'create-rule',
      entityType: 'ApprovalRule',
      entityId: rule.id,
      after: { name: rule.name, module: rule.module, action: rule.action },
    });
    return withApproverRoles(rule);
  },

  async submit(session: AppSession | null, input: ApprovalSubmitInput) {
    if (!session) throw new ForbiddenError('Not authenticated');
    const amount = input.amount ?? 0;
    const rule = await findMatchingRule(input.module, input.action, amount);
    if (!rule) {
      throw new ValidationError(
        `No approval rule configured for ${input.module}:${input.action}`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.create({
        data: {
          ruleId: rule.id,
          module: input.module,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          title: input.title,
          summary: input.summary || null,
          amount: input.amount != null ? new Prisma.Decimal(input.amount) : null,
          currency: input.currency,
          branchId: input.branchId || null,
          requestedById: session.userId,
          steps: {
            create: rule.approvers.map((a) => ({
              sequence: a.sequence,
              approverRole: a.role,
              status: a.sequence === 1 ? 'ACTIVE' : 'WAITING',
            })),
          },
        },
        include: REQUEST_INCLUDE,
      });

      await recordAudit(
        {
          actorId: session.userId,
          branchId: request.branchId,
          module: 'approvals',
          action: 'submit',
          entityType: 'ApprovalRequest',
          entityId: request.id,
          after: { module: request.module, action: request.action, title: request.title },
        },
        tx,
      );

      return request;
    }).then(async (req) => {
      const first = req.steps[0];
      if (first) {
        await notifyRole(first.approverRole, {
          module: 'approvals',
          title: `Approval needed: ${req.title}`,
          body: `${req.module}:${req.action}`,
          href: `/approvals/${req.id}`,
        });
      }
      return reshapeRequestRule(req);
    });
  },

  async requestIfNeeded(session: AppSession | null, input: ApprovalSubmitInput) {
    const amount = input.amount ?? 0;
    const rule = await findMatchingRule(input.module, input.action, amount);
    if (!rule) return null;
    return this.submit(session, input);
  },

  async ensureApprovedOrRequest(session: AppSession | null, input: ApprovalSubmitInput) {
    if (!session) throw new ForbiddenError('Not authenticated');

    const approved = await prisma.approvalRequest.findFirst({
      where: {
        module: input.module,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        status: 'APPROVED',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (approved) return approved;

    const pending = await prisma.approvalRequest.findFirst({
      where: {
        module: input.module,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        status: { in: ['PENDING', 'CHANGES_REQUESTED', 'ESCALATED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      throw new ForbiddenError(`Approval is pending for ${input.title}`);
    }

    const requested = await this.requestIfNeeded(session, input);
    if (requested) {
      throw new ForbiddenError(`Approval requested for ${input.title}`);
    }
    return null;
  },

  async list(
    session: AppSession | null,
    filters: { status?: string; mine?: boolean; forMe?: boolean } = {},
  ) {
    const actor = await authorize(session, 'approvals:read');
    const where: Prisma.ApprovalRequestWhereInput = {
      status: filters.status as Prisma.ApprovalRequestWhereInput['status'],
    };
    if (filters.mine) where.requestedById = actor.userId;
    if (filters.forMe) {
      const user = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: { roles: { select: { role: { select: { name: true } } } } },
      });
      const myRoles = user?.roles.map((r) => r.role.name) ?? [];
      const isSuperAdmin = myRoles.some((r) => r.toLowerCase().includes('super admin'));
      if (!isSuperAdmin) {
        where.steps = {
          some: { approverRole: { in: myRoles }, status: 'ACTIVE' },
        };
      }
    }
    const requests = await prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: REQUEST_INCLUDE,
    });
    const withRequesters = await attachRequesters(requests);
    return withRequesters.map(reshapeRequestRule);
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'approvals:read');
    const req = await prisma.approvalRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
    if (!req) throw new NotFoundError('Approval request not found');
    const [withRequester] = await attachRequesters([req]);
    if (!withRequester) throw new NotFoundError('Approval request not found');
    return reshapeRequestRule(withRequester);
  },

  /** Latest non-approved request for an entity, for surfacing "pending approval" banners. */
  async findLatestForEntity(
    session: AppSession | null,
    filter: { module: string; entityType: string; entityId: string },
  ) {
    await authorize(session, 'approvals:read');
    return prisma.approvalRequest.findFirst({
      where: {
        module: filter.module,
        entityType: filter.entityType,
        entityId: filter.entityId,
        status: { in: ['PENDING', 'CHANGES_REQUESTED', 'ESCALATED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async approve(session: AppSession | null, input: ApprovalDecisionInput) {
    return this.decide(session, input, 'approve');
  },

  async reject(session: AppSession | null, input: ApprovalDecisionInput) {
    return this.decide(session, input, 'reject');
  },

  async requestChanges(session: AppSession | null, input: ApprovalDecisionInput) {
    return this.decide(session, input, 'changes');
  },

  async cancel(session: AppSession | null, input: ApprovalDecisionInput) {
    const actor = await authorize(session, 'approvals:read');

    return prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findUnique({ where: { id: input.requestId } });
      if (!request) throw new NotFoundError('Request not found');
      if (request.requestedById !== actor.userId) {
        throw new ForbiddenError('Only the requester can cancel');
      }
      if (request.status !== 'PENDING' && request.status !== 'CHANGES_REQUESTED') {
        throw new ValidationError('Only pending requests can be cancelled');
      }

      const updated = await tx.approvalRequest.update({
        where: { id: request.id },
        data: { status: 'CANCELLED', decidedAt: new Date(), note: input.note || null },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: request.branchId,
          module: 'approvals',
          action: 'cancel',
          entityType: 'ApprovalRequest',
          entityId: request.id,
          after: { status: updated.status },
        },
        tx,
      );

      // Sync side effect on the linked entity runs INSIDE this same
      // transaction, not after it — see the identical fix in decide() above.
      // A cancellation that can't be reflected on its linked entity must roll
      // back entirely, not commit as "cancelled" while silently failing to apply.
      if (
        request.module === 'hr' &&
        request.action === 'employee-transfer' &&
        request.entityType === 'EmployeeTransfer' &&
        request.entityId
      ) {
        await syncEmployeeTransferApprovalState(
          {
            approvalStatus: 'CANCELLED',
            transferId: request.entityId,
            actorUserId: actor.userId,
            note: input.note,
          },
          tx,
        );
      }

      return updated;
    });
  },

  async decide(
    session: AppSession | null,
    input: ApprovalDecisionInput,
    decision: 'approve' | 'reject' | 'changes',
  ) {
    const actor = await authorize(
      session,
      decision === 'reject' ? 'approvals:reject' : 'approvals:approve',
    );
    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: { roles: { select: { role: { select: { name: true } } } } },
    });
    const myRoles = new Set(user?.roles.map((r) => r.role.name) ?? []);

    return prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findUnique({
        where: { id: input.requestId },
        include: { steps: { orderBy: { sequence: 'asc' } } },
      });
      if (!request) throw new NotFoundError('Request not found');
      if (request.status !== 'PENDING' && request.status !== 'CHANGES_REQUESTED') {
        throw new ValidationError(`Cannot decide a ${request.status.toLowerCase()} request`);
      }

      // A CHANGES_REQUESTED request has no ACTIVE step (the last decision left its
      // step in a terminal CHANGES_REQUESTED state) — fall back to that step so the
      // same approver can re-decide once the submitter has addressed the feedback,
      // instead of leaving the request permanently undecidable.
      const activeStep =
        request.steps.find((s) => s.status === 'ACTIVE') ??
        (request.status === 'CHANGES_REQUESTED'
          ? request.steps.find((s) => s.status === 'CHANGES_REQUESTED')
          : undefined);
      if (!activeStep) throw new ValidationError('No active step to decide on');
      const isSuperAdmin = Array.from(myRoles).some((r) => r.toLowerCase().includes('super admin'));
      if (!myRoles.has(activeStep.approverRole) && !isSuperAdmin) {
        throw new ForbiddenError(
          `Step ${activeStep.sequence} requires role "${activeStep.approverRole}"`,
        );
      }

      const now = new Date();
      const stepStatus =
        decision === 'approve' ? 'APPROVED' : decision === 'reject' ? 'REJECTED' : 'CHANGES_REQUESTED';

      await tx.approvalStep.update({
        where: { id: activeStep.id },
        data: {
          status: stepStatus,
          approverId: actor.userId,
          decidedAt: now,
          note: input.note || null,
        },
      });

      let nextStatus: Prisma.ApprovalRequestUpdateInput['status'] = request.status;
      let notifyNextRole: string | null = null;

      if (decision === 'reject') {
        nextStatus = 'REJECTED';
      } else if (decision === 'changes') {
        nextStatus = 'CHANGES_REQUESTED';
      } else {
        const remaining = request.steps.filter((s) => s.sequence > activeStep.sequence);
        const next = remaining[0];
        if (next) {
          await tx.approvalStep.update({
            where: { id: next.id },
            data: { status: 'ACTIVE' },
          });
          notifyNextRole = next.approverRole;
          nextStatus = 'PENDING';
        } else {
          nextStatus = 'APPROVED';
        }
      }

      const updated = await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          decidedAt:
            nextStatus === 'APPROVED' || nextStatus === 'REJECTED' ? now : request.decidedAt,
          note: input.note || null,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: request.branchId,
          module: 'approvals',
          action: decision,
          entityType: 'ApprovalRequest',
          entityId: request.id,
          before: { status: request.status, step: activeStep.sequence },
          after: { status: updated.status, decision },
        },
        tx,
      );

      // Sync side effects on the linked entity (PurchaseRequisition,
      // EmployeeTransfer, ProductionPlan) run INSIDE this same transaction,
      // not after it — an approval decision that can't be reflected on its
      // linked entity must roll back entirely, not commit as "decided" while
      // silently failing to apply. This is the fix for a bug found live:
      // these used to run in `.then()` after the transaction had already
      // committed, so a missing/deleted linked entity caused the whole
      // decide() call to reject with a 500 even though the approval's own
      // status change had already been durably saved — the caller was told
      // it failed when it had actually succeeded.
      if (
        ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'].includes(updated.status) &&
        request.module === 'hr' &&
        request.action === 'employee-transfer' &&
        request.entityType === 'EmployeeTransfer' &&
        request.entityId
      ) {
        await syncEmployeeTransferApprovalState(
          {
            approvalStatus: updated.status as 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED',
            transferId: request.entityId,
            actorUserId: actor.userId,
            note: input.note,
          },
          tx,
        );
      }
      if (
        ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'].includes(updated.status) &&
        request.module === 'purchase' &&
        ['requisition-approve', 'approve', 'invoice-approve'].includes(request.action) &&
        ['PurchaseRequisition', 'PurchaseOrder', 'PurchaseInvoice'].includes(request.entityType) &&
        request.entityId
      ) {
        await syncPurchaseApprovalState(
          {
            approvalStatus: updated.status as 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED',
            entityType: request.entityType as 'PurchaseRequisition' | 'PurchaseOrder' | 'PurchaseInvoice',
            entityId: request.entityId,
            actorUserId: actor.userId,
            note: input.note,
          },
          tx,
        );
      }
      if (
        ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'].includes(updated.status) &&
        request.module === 'factory' &&
        request.action === 'plan-approve' &&
        request.entityType === 'ProductionPlan' &&
        request.entityId
      ) {
        await syncProductionPlanApprovalState(
          {
            approvalStatus: updated.status as 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED',
            planId: request.entityId,
          },
          tx,
        );
      }

      return {
        actorUserId: actor.userId,
        updated,
        notifyNextRole,
        notifyRequester: true,
        title: request.title,
        module: request.module,
        action: request.action,
        entityType: request.entityType,
        entityId: request.entityId,
        branchId: request.branchId,
      };
    }).then(async (result) => {
      if (result.notifyNextRole) {
        await notifyRole(result.notifyNextRole, {
          module: 'approvals',
          title: `Approval needed: ${result.title}`,
          body: 'An earlier approver signed off — your decision is required.',
          href: `/approvals/${result.updated.id}`,
        });
      }
      if (result.notifyRequester) {
        await publishNotification({
          recipientId: result.updated.requestedById,
          severity:
            result.updated.status === 'REJECTED'
              ? 'WARNING'
              : result.updated.status === 'APPROVED'
                ? 'INFO'
                : 'INFO',
          module: 'approvals',
          title: `Approval ${result.updated.status.toLowerCase()}: ${result.title}`,
          body: input.note || undefined,
          href: `/approvals/${result.updated.id}`,
        });
      }
      if (
        result.updated.status === 'APPROVED' &&
        result.module === 'inventory' &&
        result.action === 'damage' &&
        result.entityType === 'DamageReport' &&
        result.entityId &&
        result.branchId
      ) {
        await publishToPermission('inventory:damage', {
          branchId: result.branchId,
          severity: 'WARNING',
          module: 'inventory',
          title: `Action pending: ${result.title}`,
          body: 'Approval is complete. Choose the final action for this faulty report.',
          href: `/warehouse/faulty/${result.entityId}`,
        });
      }
      return result.updated;
    });
  },

  async queueStats(session: AppSession | null) {
    await authorize(session, 'approvals:read');
    const [pending, approved, rejected] = await Promise.all([
      prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
      prisma.approvalRequest.count({ where: { status: 'APPROVED' } }),
      prisma.approvalRequest.count({ where: { status: 'REJECTED' } }),
    ]);
    return { pending, approved, rejected };
  },
};
