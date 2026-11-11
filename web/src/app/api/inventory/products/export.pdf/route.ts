import { NextRequest } from 'next/server';
import { auth } from '@/server/auth/config';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const session = await auth();
  const sp = req.nextUrl.searchParams.toString();
  const backendRes = await fetch(
    `${BACKEND_URL}/api/inventory/products/export.pdf${sp ? `?${sp}` : ''}`,
    {
      headers: {
        Authorization: `Bearer ${session?.backendAccessToken ?? ''}`,
      },
    },
  );

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: {
      'Content-Type': backendRes.headers.get('Content-Type') ?? 'application/pdf',
      'Content-Disposition':
        backendRes.headers.get('Content-Disposition') ?? 'attachment; filename="products.pdf"',
    },
  });
}
