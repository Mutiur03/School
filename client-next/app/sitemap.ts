import type { MetadataRoute } from "next";
import {
  getCanonicalSiteUrl,
  getRequestSiteUrl,
  getStaticSeoRoutes,
} from "@/lib/seo";
import { fetchSchoolConfig } from "@/queries/school.queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const school = await fetchSchoolConfig();
  const siteUrl = getCanonicalSiteUrl(school, await getRequestSiteUrl());

  return getStaticSeoRoutes(siteUrl);
}
