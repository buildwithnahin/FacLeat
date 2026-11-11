import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { ApiError, NotFoundError } from '@/lib/errors';

export const runtime = 'nodejs';

const CV_ROOT = path.resolve(process.cwd(), 'backend/upload/CV');

function resolveCandidateCvPath(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!absolutePath.startsWith(CV_ROOT + path.sep) && absolutePath !== CV_ROOT) {
    throw new ApiError('Invalid CV path', 400);
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
  return 'application/octet-stream';
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await authorize(await getSession(), 'hr:read');

    const candidate = await prisma.hrWorkflowRecord.findUnique({
      where: { id },
      select: {
        id: true,
        section: true,
        metadata: true,
      },
    });

    if (!candidate || candidate.section !== 'candidates') {
      throw new NotFoundError('Candidate not found');
    }

    const metadata = (candidate.metadata as Record<string, string>) || {};
    const cvPath = metadata.cvPath || '';
    const cvName = metadata.cvName || metadata.cvStoredName || 'candidate-cv';

    if (!cvPath) {
      throw new NotFoundError('CV not found');
    }

    const body = new Uint8Array(await readFile(resolveCandidateCvPath(cvPath)));

    return new Response(body, {
      headers: {
        'Content-Type': mimeTypeFromFilename(cvName),
        'Content-Disposition': `inline; filename="${encodeURIComponent(cvName)}"`,
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
