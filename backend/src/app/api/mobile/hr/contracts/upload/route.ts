import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { storagePut } from '@/server/storage';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.svg']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function extname(name: string) {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx).toLowerCase();
}

/**
 * Upload-only step for a contract's signed attachment. Kept separate from
 * `POST /hr/contracts` (which is a JSON create/update) so the contract form
 * can upload the file first, get back a `storagePath` to carry as
 * `attachmentUrl`, then submit the rest of the form as normal JSON.
 */
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return Response.json(apiError('Invalid form data'), { status: 400 });

  const file = formData.get('attachmentFile');
  if (!(file instanceof File) || file.size === 0) {
    return Response.json(apiError('Select a file to upload'), { status: 422 });
  }

  const extension = extname(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return Response.json(
      apiError('Attachment must be an image (PNG, JPG, WEBP, SVG) or document (PDF, DOC, DOCX)'),
      { status: 422 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(apiError('Attachment file size must be 10MB or less'), { status: 422 });
  }

  try {
    const { storagePath } = await storagePut(file.name, Buffer.from(await file.arrayBuffer()));
    return Response.json(apiOk({ attachmentUrl: storagePath }));
  } catch (err) {
    console.error('POST /api/mobile/hr/contracts/upload failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
