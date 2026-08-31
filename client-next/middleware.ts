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
  const tenantHostname = (
    request.headers.get('x-tenant-host') ??
    request.headers.get('x-forwarded-host') ??
    ''
  )
    .split(',')[0]
    .trim()
    .split(':')[0];
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);

  let response: NextResponse;

  if (isBareLocalHost(hostname) && !tenantHostname && pathname.startsWith('/api/')) {
    return new NextResponse('Tenant host required', { status: 404 });
  }

  if (
    (hostname.endsWith('.localhost') || tenantHostname.endsWith('.localhost')) &&
    pathname.startsWith('/api/')
  ) {
    const forwardedHostname = tenantHostname || hostname;
    headers.set('x-forwarded-host', forwardedHostname);
    headers.set('x-tenant-host', forwardedHostname);
    headers.set('origin', `http://${forwardedHostname}`);
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
