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
import fs from "fs";
import path from "path";
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
  const fontPath = path.join(process.cwd(), "app/fonts/Kalpurush-v0.258.woff2");
  const fontBase64 = fs.readFileSync(fontPath).toString("base64");

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
          @font-face {
            font-family: "Kalpurush";
            src: url("data:font/woff2;base64,${fontBase64}") format("woff2");
            font-weight: 100 900;
            font-display: block;
          }

          html, body {
            font-family: "Kalpurush", sans-serif;
          }
        `}} />
        <link rel="preload" href="/bg.png" as="image" fetchPriority="high" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
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
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
