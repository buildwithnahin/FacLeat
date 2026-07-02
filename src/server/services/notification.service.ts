import 'server-only';
import { prisma } from '@/server/db';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, UnauthorizedError } from '@/lib/errors';

export const notificationService = {
  async list(session: AppSession | null, filters: { onlyUnread?: boolean; limit?: number } = {}) {
    if (!session) throw new UnauthorizedError();
    return prisma.notification.findMany({
      where: {
        recipientId: session!.userId,
        readAt: filters.onlyUnread ? null : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
    });
  },

  async unreadCount(session: AppSession | null) {
    if (!session) throw new UnauthorizedError();
    return prisma.notification.count({
      where: { recipientId: session!.userId, readAt: null },
    });
  },

  async markRead(session: AppSession | null, id: string) {
    if (!session) throw new UnauthorizedError();
    const actor = session;
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.recipientId !== actor.userId) {
      throw new NotFoundError('Notification not found');
    }
    return prisma.notification.update({
      where: { id },
      data: { readAt: notif.readAt ?? new Date() },
    });
  },

  async markAllRead(session: AppSession | null) {
    if (!session) throw new UnauthorizedError();
    const actor = session;
    const result = await prisma.notification.updateMany({
      where: { recipientId: actor.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  },
};
