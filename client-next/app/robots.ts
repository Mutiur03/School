import type { MetadataRoute } from "next";
import { getRequestSiteUrl, getSchoolSiteUrl } from "@/lib/seo";
import { fetchSchoolConfig } from "@/queries/school.queries";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const school = await fetchSchoolConfig();
  const siteUrl = getSchoolSiteUrl(school, await getRequestSiteUrl());

  return {
    rules: {
      userAgent: "*",
      allow: school.seo?.noIndex ? undefined : "/",
      disallow: school.seo?.noIndex ? "/" : undefined,
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
