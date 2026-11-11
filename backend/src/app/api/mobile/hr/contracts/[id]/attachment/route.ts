import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError } from '@/lib/api';
import { authorize } from '@/server/auth/authorize';
import { prisma } from '@/server/db';
import { storageGet } from '@/server/storage';
import { ApiError, NotFoundError } from '@/lib/errors';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

function mimeTypeFromFilename(fileName: string) {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.doc') return 'application/msword';
  if (extension === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    await authorize(session, 'hr:read');
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { attachmentUrl: true },
    });
    if (!contract?.attachmentUrl) throw new NotFoundError('Attachment not found');

    const buffer = await storageGet(contract.attachmentUrl);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeTypeFromFilename(contract.attachmentUrl),
        'Content-Disposition': `inline; filename="${encodeURIComponent(contract.attachmentUrl.split('/').pop() || 'attachment')}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/contracts/[id]/attachment failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
