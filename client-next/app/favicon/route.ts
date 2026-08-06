import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  getRequestSiteUrl,
  getSchoolIconUrl,
  getSchoolSiteUrl,
} from "@/lib/seo";
import { fetchSchoolConfig } from "@/queries/school.queries";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

async function loadIconBytes(iconUrl: string, tenantKey: string) {
  const upstream = await fetch(iconUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return null;
  }
  const contentType = upstream.headers.get("content-type") || "image/png";
  const body = await upstream.arrayBuffer();
  return {
    contentType,
    body: Buffer.from(body).toString("base64"),
    tenantKey,
  };
}

export async function GET() {
  const incoming = await headers();
  const tenantKey = (
    incoming.get("x-tenant-host")?.trim() ||
    incoming.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    incoming.get("host")?.split(":")[0]?.trim() ||
    "default"
  ).toLowerCase();

  const school = await fetchSchoolConfig();
  const siteUrl = getSchoolSiteUrl(school, await getRequestSiteUrl());
  const iconUrl = getSchoolIconUrl(school, siteUrl);

  if (!iconUrl) {
    return new NextResponse(null, { status: 404 });
  }

  // Cache icon bytes per tenant + URL so school A never receives school B's logo.
  const cached = unstable_cache(
    async (url: string, tenant: string) => loadIconBytes(url, tenant),
    ["favicon-bytes"],
    { revalidate: 86400, tags: [`tenant:${tenantKey}`, "favicon"] },
  );

  const icon = await cached(iconUrl, tenantKey);
  if (!icon) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(Buffer.from(icon.body, "base64"), {
    headers: {
      "Content-Type": icon.contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      // Critical for multi-tenant: CDN must not reuse favicon across hosts.
      Vary: "Host, Accept-Encoding",
    },
  });
}
