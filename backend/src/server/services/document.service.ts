import 'server-only';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { storagePut, storageGet, storageRemove } from '@/server/storage';
import type { AppSession } from '@/server/auth/session';
import type { DocumentUploadInput, DocumentLinkInput } from '@/server/validators/documents';
import { NotFoundError, ValidationError } from '@/lib/errors';

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf', 'application/vnd.', 'application/msword', 'text/'];

/**
 * MySQL has no scalar array type, so `Document.tags` is now a join table
 * (one row per tag). Reshape back to a flat `tags: string[]` on every read
 * so the API contract (consumed by web/) is unchanged.
 */
function withTags<T extends { tags: { tag: string }[] }>(doc: T) {
  const { tags, ...rest } = doc;
  return { ...rest, tags: tags.map((t) => t.tag) };
}

export const documentService = {
  async list(
    session: AppSession | null,
    filters: { branchId?: string; category?: string; search?: string } = {},
  ) {
    await authorize(session, 'documents:read');
    const docs = await prisma.document.findMany({
      where: {
        branchId: filters.branchId,
        category: filters.category,
        OR: filters.search
          ? [
              { originalName: { contains: filters.search } },
              { fileName: { contains: filters.search } },
              { tags: { some: { tag: { contains: filters.search } } } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { _count: { select: { links: true } }, tags: true },
    });
    return docs.map(withTags);
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'documents:read');
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        links: { orderBy: { createdAt: 'desc' } },
        tags: true,
      },
    });
    if (!doc) throw new NotFoundError('Document not found');
    return withTags(doc);
  },

  async listForEntity(
    session: AppSession | null,
    entityType: string,
    entityId: string,
  ) {
    await authorize(session, 'documents:read');
    const links = await prisma.documentLink.findMany({
      where: { entityType, entityId },
      include: { document: { include: { tags: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return links.map((l) => ({ ...withTags(l.document), linkId: l.id, linkNote: l.note }));
  },

  async upload(
    session: AppSession | null,
    file: File,
    meta: DocumentUploadInput,
  ) {
    const actor = await authorize(session, 'documents:write');
    if (file.size <= 0) throw new ValidationError('Empty file');
    if (file.size > MAX_BYTES) {
      throw new ValidationError(`File exceeds ${MAX_BYTES / (1024 * 1024)}MB limit`);
    }
    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
      throw new ValidationError(`Unsupported file type: ${mime}`);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await storagePut(file.name, buf);
    const fileName = path.basename(storagePath);

    const doc = await prisma.document.create({
      data: {
        branchId: meta.branchId || null,
        fileName,
        originalName: file.name,
        mimeType: mime,
        size: file.size,
        storagePath,
        category: meta.category || null,
        tags: { create: meta.tags.map((tag) => ({ tag })) },
        expiresAt: meta.expiresAt ?? null,
        uploadedById: actor.userId,
        notes: meta.notes || null,
      },
      include: { tags: true },
    });
    await recordAudit({
      actorId: actor.userId,
      branchId: doc.branchId,
      module: 'documents',
      action: 'upload',
      entityType: 'Document',
      entityId: doc.id,
      after: {
        name: doc.originalName,
        size: doc.size,
        mime: doc.mimeType,
        category: doc.category,
      },
    });
    return withTags(doc);
  },

  async download(session: AppSession | null, id: string) {
    await authorize(session, 'documents:read');
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundError('Document not found');
    const buf = await storageGet(doc.storagePath);
    return {
      buffer: buf,
      fileName: doc.originalName,
      mimeType: doc.mimeType,
      size: doc.size,
    };
  },

  async link(session: AppSession | null, input: DocumentLinkInput) {
    const actor = await authorize(session, 'documents:write');
    try {
      const link = await prisma.documentLink.create({
        data: {
          documentId: input.documentId,
          entityType: input.entityType,
          entityId: input.entityId,
          note: input.note || null,
        },
      });
      await recordAudit({
        actorId: actor.userId,
        branchId: null,
        module: 'documents',
        action: 'link',
        entityType: 'DocumentLink',
        entityId: link.id,
        after: { documentId: input.documentId, entityType: input.entityType, entityId: input.entityId },
      });
      return link;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ValidationError('Already linked');
      }
      throw e;
    }
  },

  async unlink(session: AppSession | null, linkId: string) {
    const actor = await authorize(session, 'documents:write');
    const link = await prisma.documentLink.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundError('Link not found');
    await prisma.documentLink.delete({ where: { id: linkId } });
    await recordAudit({
      actorId: actor.userId,
      branchId: null,
      module: 'documents',
      action: 'unlink',
      entityType: 'DocumentLink',
      entityId: linkId,
      before: {
        documentId: link.documentId,
        entityType: link.entityType,
        entityId: link.entityId,
      },
    });
  },

  async remove(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'documents:delete');
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { _count: { select: { links: true } } },
    });
    if (!doc) throw new NotFoundError('Document not found');
    if (doc._count.links > 0) {
      throw new ValidationError('Document is linked to entities — unlink first');
    }
    // Remove the physical file before the DB row, so a storage failure leaves
    // the document record (and its audit trail) intact instead of orphaning the
    // file with no remaining pointer to it.
    await storageRemove(doc.storagePath);
    await prisma.document.delete({ where: { id } });
    await recordAudit({
      actorId: actor.userId,
      branchId: doc.branchId,
      module: 'documents',
      action: 'delete',
      entityType: 'Document',
      entityId: id,
      before: { name: doc.originalName },
    });
  },

  async expiringSoon(session: AppSession | null, days = 30) {
    await authorize(session, 'documents:read');
    const limit = new Date();
    limit.setDate(limit.getDate() + days);
    return prisma.document.findMany({
      where: { expiresAt: { gte: new Date(), lte: limit } },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });
  },
};
