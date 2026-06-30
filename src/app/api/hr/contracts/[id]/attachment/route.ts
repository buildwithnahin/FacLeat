import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { ApiError, NotFoundError } from '@/lib/errors';

export const runtime = 'nodejs';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'server/upload');

function resolveAttachmentPath(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!absolutePath.startsWith(UPLOAD_ROOT + path.sep) && absolutePath !== UPLOAD_ROOT) {
    throw new ApiError(400, 'Invalid attachment path');
  }
  return absolutePath;
}

function mimeTypeFromFilename(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.doc') return 'application/msword';
  if (extension === '.docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await authorize(await getSession(), 'hr:read');

    const contract = await prisma.contract.findUnique({
      where: { id },
      select: {
        attachmentUrl: true,
        contractNo: true,
      },
    });

    if (!contract || !contract.attachmentUrl) {
      throw new NotFoundError('Attachment not found');
    }

    const absolutePath = resolveAttachmentPath(contract.attachmentUrl);
    const body = new Uint8Array(await readFile(absolutePath));

    return new Response(body, {
      headers: {
        'Content-Type': mimeTypeFromFilename(contract.attachmentUrl),
        'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(contract.attachmentUrl))}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return new Response(e.message, { status: e.status });
    }
    throw e;
  }
}
