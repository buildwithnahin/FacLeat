import 'server-only';
import { auth } from '@/server/auth/config';

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export class BackendApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

/**
 * Server-side fetch against backend/'s API, attaching the current NextAuth
 * session's backend-issued Bearer token. This is the ONE place web/'s
 * Server Components and Server Actions should reach the backend from —
 * mirrors the role `ApiClient`/dio plays in the Flutter app.
 *
 * Known gap (flagged, not solved here): no automatic refresh-token retry
 * yet. The backend access token is short-lived (15 min, same contract the
 * mobile app already lives with); a request made after it expires will get
 * a 401 from the backend and this throws `BackendApiError` with status 401.
 * A real fix needs either re-minting the NextAuth JWT mid-request (awkward
 * from a Server Component) or moving session refresh to a client-side
 * interceptor — deferred to a follow-up pass once more of the app is wired
 * through this client and the shape of the problem is clearer.
 */
export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await auth();
  if (!session?.backendAccessToken) {
    throw new BackendApiError('Not authenticated', 401);
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.backendAccessToken}`,
      ...init?.headers,
    },
    cache: 'no-store',
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new BackendApiError(
      json?.error ?? `Backend request failed (${res.status})`,
      res.status,
      json?.details,
    );
  }
  return json.data as T;
}

/**
 * Multipart-upload twin of `backendFetch`. Deliberately does NOT set
 * `Content-Type` — `fetch` derives the multipart boundary itself when the
 * body is a `FormData`, and forcing `application/json` (like `backendFetch`
 * does) would corrupt the upload.
 */
export async function backendUpload<T>(path: string, formData: FormData): Promise<T> {
  const session = await auth();
  if (!session?.backendAccessToken) {
    throw new BackendApiError('Not authenticated', 401);
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.backendAccessToken}`,
    },
    body: formData,
    cache: 'no-store',
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new BackendApiError(
      json?.error ?? `Backend request failed (${res.status})`,
      res.status,
      json?.details,
    );
  }
  return json.data as T;
}
