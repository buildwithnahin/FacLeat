import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { documentService } from '@/server/services/document.service';
import { documentUploadSchema } from '@/server/validators/documents';

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const sp = req.nextUrl.searchParams;
  const filters = {
    branchId: sp.get('branchId') ?? undefined,
    category: sp.get('category') ?? undefined,
    search: sp.get('search') ?? undefined,
  };

  try {
    const data = await documentService.list(session, filters);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/documents failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}

/** Multipart upload — mirrors the old `uploadDocumentAction`'s FormData parsing. */
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return Response.json(apiError('Invalid form data'), { status: 400 });

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return Response.json(apiError('Select a file to upload'), { status: 422 });
  }

  const tagsRaw = formData.get('tags');
  const tags =
    typeof tagsRaw === 'string'
      ? tagsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  const expiresRaw = formData.get('expiresAt');

  const parsed = documentUploadSchema.safeParse({
    branchId: formData.get('branchId') ?? '',
    category: formData.get('category') ?? '',
    tags,
    expiresAt: typeof expiresRaw === 'string' && expiresRaw ? expiresRaw : undefined,
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return Response.json(apiError('Validation failed', parsed.error.flatten()), { status: 422 });
  }

  try {
    const data = await documentService.upload(session, file, parsed.data);
    return Response.json(apiOk(data));
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('POST /api/mobile/documents failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
