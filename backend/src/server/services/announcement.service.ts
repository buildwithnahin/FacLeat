import 'server-only';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { publishNotification } from '@/server/notifications/publisher';
import { documentService } from '@/server/services/document.service';
import type { AppSession } from '@/server/auth/session';
import type { CreateAnnouncementInput } from '@/server/validators/announcements';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

const ANNOUNCEMENT_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  audienceBranch: { select: { id: true, name: true } },
} as const;

export const announcementService = {
  async create(session: AppSession | null, input: CreateAnnouncementInput) {
    const actor = await authorize(session, 'announcements:write');

    // Company scoping for broad audiences (ALL / DEPARTMENT) mirrors the
    // pattern in user.service.ts's list(): a user is "in" the actor's active
    // company if their defaultCompanyId matches it, their default branch
    // belongs to it, or any of their branch accesses belong to it. When the
    // actor has no active company selected (e.g. a true super admin with
    // ALL_BRANCHES access and nothing scoped), the query stays unscoped —
    // same fallback user.service.ts uses.
    const companyScope = actor.activeCompanyId
      ? {
          OR: [
            { defaultCompanyId: actor.activeCompanyId },
            { defaultBranch: { companyId: actor.activeCompanyId } },
            { branchAccesses: { some: { branch: { companyId: actor.activeCompanyId } } } },
          ],
        }
      : {};

    let recipientIds: string[] = [];
    if (input.audienceType === 'ALL') {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE', ...companyScope },
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
    } else if (input.audienceType === 'BRANCH') {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE', defaultBranchId: input.audienceBranchId },
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
    } else if (input.audienceType === 'DEPARTMENT') {
      const users = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          employee: { department: input.audienceDepartment },
          ...companyScope,
        },
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
    } else {
      const user = await prisma.user.findUnique({
        where: { id: input.audienceUserId, status: 'ACTIVE' },
      });
      if (!user) throw new NotFoundError('Target user not found');
      recipientIds = [user.id];
    }

    const announcement = await prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          title: input.title,
          body: input.body,
          audienceType: input.audienceType,
          audienceBranchId: input.audienceType === 'BRANCH' ? input.audienceBranchId : null,
          audienceDepartment: input.audienceType === 'DEPARTMENT' ? input.audienceDepartment : null,
          audienceUserId: input.audienceType === 'USER' ? input.audienceUserId : null,
          createdById: actor.userId,
        },
        include: ANNOUNCEMENT_INCLUDE,
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.audienceType === 'BRANCH' ? (input.audienceBranchId ?? null) : null,
          module: 'announcements',
          action: 'create',
          entityType: 'Announcement',
          entityId: created.id,
          after: {
            title: created.title,
            audienceType: created.audienceType,
            audienceBranchId: created.audienceBranchId,
            audienceDepartment: created.audienceDepartment,
            audienceUserId: created.audienceUserId,
            recipientCount: recipientIds.length,
          },
        },
        tx,
      );

      return created;
    });

    if (input.documentIds?.length) {
      // The announcement row is already committed at this point. If linking
      // an attachment fails, don't let it bubble up and error out a request
      // whose announcement was in fact created successfully — that would
      // read as total failure to the caller and invite a retry that creates
      // a duplicate announcement, while the first one sits un-notified and
      // orphaned. Log and continue on to the notification fan-out instead;
      // a missing attachment link is recoverable, a phantom announcement isn't.
      for (const documentId of input.documentIds) {
        try {
          await documentService.link(session, {
            documentId,
            entityType: 'Announcement',
            entityId: announcement.id,
          });
        } catch (err) {
          console.error(
            `announcement.create: failed to link document ${documentId} to announcement ${announcement.id}`,
            err,
          );
        }
      }
    }

    // Fire notifications after the announcement itself has been durably
    // created — mirrors approval.service.ts's decide(), which publishes
    // notifications in a `.then()` after its own transaction commits. Pure
    // notification fan-out should never roll back a successfully created
    // announcement just because one recipient's notification insert fails.
    const truncatedBody = input.body.length > 200 ? `${input.body.slice(0, 200)}…` : input.body;
    for (const recipientId of recipientIds) {
      await publishNotification({
        recipientId,
        branchId: input.audienceType === 'BRANCH' ? (input.audienceBranchId ?? null) : null,
        severity: 'INFO',
        module: 'announcements',
        title: input.title,
        body: truncatedBody,
        href: `/announcements/${announcement.id}`,
      });
    }

    return { ...announcement, recipientCount: recipientIds.length };
  },

  async list(session: AppSession | null, filters: { limit?: number } = {}) {
    await authorize(session, 'announcements:read');
    return prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      include: ANNOUNCEMENT_INCLUDE,
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'announcements:read');
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: ANNOUNCEMENT_INCLUDE,
    });
    if (!announcement) throw new NotFoundError('Announcement not found');

    // Attachments are best-effort here: a caller with announcements:read but
    // not documents:read should still be able to view the announcement.
    // documentService.listForEntity() gates on documents:read internally, so
    // degrade to an empty list on that specific denial rather than failing
    // the whole request — any other error (e.g. a genuine DB failure) still
    // propagates normally.
    let attachments: Awaited<ReturnType<typeof documentService.listForEntity>> = [];
    try {
      attachments = await documentService.listForEntity(session, 'Announcement', id);
    } catch (err) {
      if (!(err instanceof ForbiddenError)) throw err;
    }
    return { ...announcement, attachments };
  },
};
