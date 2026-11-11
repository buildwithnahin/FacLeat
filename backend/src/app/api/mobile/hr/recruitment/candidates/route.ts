import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { recruitmentService } from '@/server/services/recruitment.service';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  try {
    const status = req.nextUrl.searchParams.get('status') ?? undefined;
    const candidates = await recruitmentService.listCandidates(session, { status });
    return Response.json(apiOk(candidates));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/recruitment/candidates failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

/** Multipart — candidate profile fields plus an optional CV upload. */
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return Response.json(apiError('Invalid form data'), { status: 400 });

  const cvFile = formData.get('cvFile');
  let cv: { name: string; buffer: Buffer } | null = null;
  if (cvFile instanceof File && cvFile.size > 0) {
    cv = { name: cvFile.name, buffer: Buffer.from(await cvFile.arrayBuffer()) };
  }

  try {
    const row = await recruitmentService.createCandidate(
      session,
      {
        name: String(formData.get('name') || ''),
        recruitmentRequestId: String(formData.get('recruitmentRequestId') || ''),
        phone: String(formData.get('phone') || ''),
        email: String(formData.get('email') || ''),
        experience: String(formData.get('experience') || ''),
        education: String(formData.get('education') || ''),
        expectedSalary: Number(formData.get('expectedSalary') || 0),
        source: String(formData.get('source') || 'LinkedIn'),
      },
      cv,
    );
    return Response.json(apiOk(row));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/hr/recruitment/candidates failed', err);
    return Response.json(apiError(err instanceof Error ? err.message : 'Internal server error'), { status: 400 });
  }
}
