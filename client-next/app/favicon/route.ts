import { NextResponse } from "next/server";
import {
  getRequestSiteUrl,
  getSchoolIconUrl,
  getSchoolSiteUrl,
} from "@/lib/seo";
import { fetchSchoolConfig } from "@/queries/school.queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const school = await fetchSchoolConfig();
  const siteUrl = getSchoolSiteUrl(school, await getRequestSiteUrl());
  const iconUrl = getSchoolIconUrl(school, siteUrl);

  if (!iconUrl) {
    return new NextResponse(null, { status: 404 });
  }

  const upstream = await fetch(iconUrl, { next: { revalidate: 86400 } });
  if (!upstream.ok) {
    return new NextResponse(null, { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") || "image/png";

  return new NextResponse(await upstream.arrayBuffer(), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
