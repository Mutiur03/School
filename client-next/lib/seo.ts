import type { Metadata } from "next";
import { headers } from "next/headers";
import type { SchoolConfig } from "@/types";
import { cdn, getFileUrl } from "@/lib/cdn";

const staticRoutes = [
  "/",
  "/notices",
  "/gallery",
  "/teacher-list",
  "/staff-list",
  "/message-from-head",
  "/admission",
  "/admission/notice",
  "/admission/results",
  "/at-a-glance",
  "/events",
  "/exam-routine",
];

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const clean = (value: string | undefined | null) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const normalizeUrl = (value: string | undefined | null) => {
  const trimmed = clean(value);
  if (!trimmed) return undefined;

  try {
    return new URL(isAbsoluteUrl(trimmed) ? trimmed : `https://${trimmed}`).toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
};

export async function getRequestSiteUrl() {
  try {
    const incomingHeaders = await headers();
    const host = incomingHeaders.get("host");
    if (!host) return undefined;

    const protocol =
      incomingHeaders.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");

    return `${protocol}://${host}`;
  } catch {
    return undefined;
  }
}

export function getSchoolSiteUrl(school: SchoolConfig, requestUrl?: string) {
  return (
    normalizeUrl(requestUrl) ||
    normalizeUrl(school.seo?.canonicalUrl) ||
    normalizeUrl(school.contact.website) ||
    normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    "http://localhost:3000"
  );
}

export function resolveSeoAssetUrl(
  value: string | undefined | null,
  siteUrl: string,
) {
  const raw = clean(value);
  if (!raw) return undefined;
  if (isAbsoluteUrl(raw)) return raw;
  if (raw.startsWith("/") && !cdn) return new URL(raw, siteUrl).toString();

  const fileUrl = getFileUrl(raw);
  if (!fileUrl || fileUrl.startsWith("undefined/")) {
    return raw.startsWith("/") ? new URL(raw, siteUrl).toString() : undefined;
  }

  return isAbsoluteUrl(fileUrl) ? fileUrl : new URL(fileUrl, siteUrl).toString();
}

export function getSchoolIconUrl(school: SchoolConfig, siteUrl: string) {
  return (
    resolveSeoAssetUrl(school.assets.favicon, siteUrl) ||
    resolveSeoAssetUrl(school.assets.logo, siteUrl)
  );
}

function getSeoDescription(school: SchoolConfig) {
  return (
    clean(school.seo?.description) ||
    clean(school.descriptions.main) ||
    `${school.name.en} official website. Notices, admission, results, teachers, events, and school information.`
  );
}

function getSeoKeywords(school: SchoolConfig) {
  const keywords = [
    ...(school.seo?.keywords ?? []),
    school.name.en,
    school.name.bn,
    school.name.shortEn,
    school.contact.upazila,
    school.contact.district,
    "school",
    "admission",
    "notices",
    "results",
  ];

  return [...new Set(keywords.map(clean).filter(Boolean) as string[])];
}

export async function buildSchoolMetadata(
  school: SchoolConfig,
): Promise<Metadata> {
  const requestUrl = await getRequestSiteUrl();
  const siteUrl = getSchoolSiteUrl(school, requestUrl);
  const title = clean(school.seo?.title) || school.name.en || "School Website";
  const description = getSeoDescription(school);
  const iconUrl = getSchoolIconUrl(school, siteUrl) || "/favicon.ico";
  const imageUrl =
    resolveSeoAssetUrl(school.seo?.image, siteUrl) ||
    resolveSeoAssetUrl(school.assets.headerLogo, siteUrl) ||
    resolveSeoAssetUrl(school.assets.logo, siteUrl);

  return {
    metadataBase: new URL(siteUrl),
    applicationName: school.name.en,
    title: {
      default: `${title} | Official Website`,
      template: `%s | ${school.name.shortEn || school.name.en}`,
    },
    description,
    keywords: getSeoKeywords(school),
    category: "education",
    icons: {
      icon: iconUrl,
      shortcut: iconUrl,
      apple: iconUrl,
    },
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      url: siteUrl,
      siteName: school.name.en,
      title,
      description,
      locale: "en_US",
      alternateLocale: ["bn_BD"],
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: school.name.en,
            },
          ]
        : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: {
      index: !school.seo?.noIndex,
      follow: !school.seo?.noIndex,
      googleBot: {
        index: !school.seo?.noIndex,
        follow: !school.seo?.noIndex,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export function buildSchoolJsonLd(school: SchoolConfig, siteUrl: string) {
  const logo =
    resolveSeoAssetUrl(school.assets.logo, siteUrl) ||
    resolveSeoAssetUrl(school.assets.favicon, siteUrl);
  const image =
    resolveSeoAssetUrl(school.seo?.image, siteUrl) ||
    resolveSeoAssetUrl(school.assets.headerLogo, siteUrl) ||
    logo;

  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: school.name.en,
    alternateName: [school.name.bn, school.name.shortEn].filter(Boolean),
    url: siteUrl,
    logo,
    image,
    description: getSeoDescription(school),
    email: school.contact.email,
    telephone: school.contact.phone,
    foundingDate: school.history.established,
    identifier: school.identifiers.eiin
      ? {
          "@type": "PropertyValue",
          name: "EIIN",
          value: school.identifiers.eiin,
        }
      : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: school.contact.address || school.contact.location,
      addressLocality: school.contact.upazila,
      addressRegion: school.contact.district,
      addressCountry: "BD",
    },
  };
}

export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function getStaticSeoRoutes(siteUrl: string) {
  return staticRoutes.map((route) => ({
    url: new URL(route, siteUrl).toString(),
    lastModified: new Date(),
    changeFrequency: route === "/" ? "daily" as const : "weekly" as const,
    priority: route === "/" ? 1 : 0.7,
  }));
}
