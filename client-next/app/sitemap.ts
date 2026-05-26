import type { MetadataRoute } from "next";
import { getRequestSiteUrl, getSchoolSiteUrl, getStaticSeoRoutes } from "@/lib/seo";
import { fetchSchoolConfig } from "@/queries/school.queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const school = await fetchSchoolConfig();
  const siteUrl = getSchoolSiteUrl(school, await getRequestSiteUrl());

  return getStaticSeoRoutes(siteUrl);
}
