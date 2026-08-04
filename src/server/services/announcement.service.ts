import 'server-only';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { publishNotification } from '@/server/notifications/publisher';
import { documentService } from '@/server/services/document.service';
import type { AppSession } from '@/server/auth/session';
import type { CreateAnnouncementInput } from '@/server/validators/announcements';
import { NotFoundError } from '@/lib/errors';

const ANNOUNCEMENT_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  audienceBranch: { select: { id: true, name: true } },
} as const;

export const announcementService = {
  async create(session: AppSession | null, input: CreateAnnouncementInput) {
    const actor = await authorize(session, 'announcements:write');

    let recipientIds: string[] = [];
    if (input.audienceType === 'ALL') {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE' },
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
        where: { status: 'ACTIVE', employee: { department: input.audienceDepartment } },
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
      for (const documentId of input.documentIds) {
        await documentService.link(session, {
          documentId,
          entityType: 'Announcement',
          entityId: announcement.id,
        });
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

    const attachments = await documentService.listForEntity(session, 'Announcement', id);
    return { ...announcement, attachments };
  },
};
