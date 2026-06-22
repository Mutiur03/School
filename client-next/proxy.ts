import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDevTenantHost, isBareLocalHost } from "@/lib/resolveBackend";

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? "").split(":")[0];

  if (!isBareLocalHost(hostname) || !request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const tenantHost = getDevTenantHost();
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", tenantHost);
  headers.set("x-tenant-host", tenantHost);
  headers.set("origin", `http://${tenantHost}`);

  return NextResponse.next({
    request: { headers },
  });
}

export const config = {
  matcher: "/api/:path*",
};
