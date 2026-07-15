import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { Analytics } from "@/components/Analytics";
import { fetchSchoolConfig } from "@/queries/school.queries";
import {
  buildSchoolJsonLd,
  buildSchoolMetadata,
  getRequestSiteUrl,
  getSchoolSiteUrl,
  serializeJsonLd,
} from "@/lib/seo";
import { Footer } from "@/components/Footer";
import Header from "@/components/HeaderClient";
import { Navbar } from "@/components/Navbar";
import { TopBanner } from "@/components/TopBanner";
import governmentLogoImage from "../assets/images/gov-logo.png";
import { Analytics as VAnalytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
// import { Observa } from "@mutiur03/observa-web/react";
export async function generateMetadata(): Promise<Metadata> {
  const school = await fetchSchoolConfig();
  return buildSchoolMetadata(school);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const school = await fetchSchoolConfig();
  const assets = school?.assets;
  const siteUrl = getSchoolSiteUrl(school, await getRequestSiteUrl());
  const jsonLd = buildSchoolJsonLd(school, siteUrl);

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link
          rel="preload"
          href="/fonts/Kalpurush-v0.258.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="preload" href="/bg.png" as="image" fetchPriority="high" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow"
        >
          Skip to main content
        </a>
        <Analytics measurementId={school?.gaMeasurementId} />
        {/* {process.env.NEXT_PUBLIC_OBSERVA_PUBLIC_KEY && (
          <Observa
            apiKey={process.env.NEXT_PUBLIC_OBSERVA_PUBLIC_KEY}
          />
        )} */}
        <VAnalytics />
        <SpeedInsights />
        <Providers>
          <div className="container">
            <Header
              bannerImages={assets?.banners ?? []}
              headerLogo={assets?.headerLogo ?? ""}
              leftLogo={assets?.logo ?? ""}
              rightLogo={(assets as { governmentLogo?: string } | undefined)?.governmentLogo ?? governmentLogoImage}
              titleBn={String(school?.name?.bn ?? "")}
              titleEn={String(school?.name?.en ?? "")}
              school={school!}
            />
            <Navbar school={school!} />
            <hr className="border-t border-gray-300" />
            <TopBanner />
            <main id="main-content" tabIndex={-1} className="outline-none">
              {children}
            </main>
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
