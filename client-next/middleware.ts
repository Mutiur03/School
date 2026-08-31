import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isBareLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Edge middleware (not Next 16 `proxy.ts` / Node middleware).
 * Required for dual deploy: OpenNext Cloudflare does not support Node middleware yet.
 * Logic is Edge-safe (headers only) and works on Vercel too.
 */
export function middleware(request: NextRequest) {
  const hostname = (request.headers.get('host') ?? '').split(':')[0];
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);

  let response: NextResponse;

  if (isBareLocalHost(hostname) && pathname.startsWith('/api/')) {
    return new NextResponse('Tenant host required', { status: 404 });
  }

  if (hostname.endsWith('.localhost') && pathname.startsWith('/api/')) {
    headers.set('x-forwarded-host', hostname);
    headers.set('x-tenant-host', hostname);
    headers.set('origin', `http://${hostname}`);
    response = NextResponse.next({ request: { headers } });
  } else {
    response = NextResponse.next({ request: { headers } });
  }

  // CDN-friendly HTML caching (per-host on Vercel/CF). Skip immutable Next assets.
  if (!pathname.startsWith('/_next/') && !pathname.startsWith('/api/') && !pathname.includes('.')) {
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    response.headers.set('Vary', 'Host, Accept-Encoding');
  }

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
