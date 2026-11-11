import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { recruitmentService } from '@/server/services/recruitment.service';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

function mimeTypeFromFilename(fileName: string) {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.doc') return 'application/msword';
  if (extension === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const { buffer, cvName } = await recruitmentService.getCandidateCv(session, id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeTypeFromFilename(cvName),
        'Content-Disposition': `inline; filename="${encodeURIComponent(cvName)}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/recruitment/candidates/[id]/cv failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
