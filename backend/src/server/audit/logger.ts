import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';

export interface AuditInput {
  actorId: string | null;
  branchId: string | null;
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Record an audit row. Call from inside the same `$transaction` as the
 * mutation to keep audit + data consistent.
 */
export async function recordAudit(
  input: AuditInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const [actorExists, branchExists] = await Promise.all([
    input.actorId
      ? tx.user.findUnique({
          where: { id: input.actorId },
          select: { id: true },
        })
      : null,
    input.branchId
      ? tx.branch.findUnique({
          where: { id: input.branchId },
          select: { id: true },
        })
      : null,
  ]);

  const data: Prisma.AuditLogCreateInput = {
    module: input.module,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    ip: input.ip,
    userAgent: input.userAgent,
    actor: actorExists ? { connect: { id: actorExists.id } } : undefined,
    branch: branchExists ? { connect: { id: branchExists.id } } : undefined,
  };

  await tx.auditLog.create({ data });
}
