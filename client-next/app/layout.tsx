import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import { Analytics } from '@/components/Analytics';
import { VercelTelemetry } from '@/components/VercelTelemetry';
import { fetchSchoolConfig } from '@/queries/school.queries';
import {
  buildSchoolJsonLd,
  buildSchoolMetadata,
  getRequestSiteUrl,
  getSchoolSiteUrl,
  serializeJsonLd,
} from '@/lib/seo';
import { Footer } from '@/components/Footer';
import Header from '@/components/HeaderClient';
import { Navbar } from '@/components/Navbar';
import { TopBanner } from '@/components/TopBanner';
import governmentLogoImage from '../assets/images/gov-logo.png';

/**
 * Multi-tenant: headers()/Host still force dynamic rendering.
 * Do not use force-dynamic — it disables fetch Data Cache / ISR-style
 * revalidation that both Vercel and OpenNext R2 cache rely on.
 * API GETs are cached per tenant host (see lib/backend.ts).
 */
export const revalidate = 60;

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
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow"
        >
          Skip to main content
        </a>
        <Analytics measurementId={school?.gaMeasurementId} />
        <VercelTelemetry />
        <Providers>
          <div className="container">
            <Header
              bannerImages={assets?.banners ?? []}
              headerLogo={assets?.headerLogo ?? ''}
              leftLogo={assets?.logo ?? ''}
              rightLogo={
                (assets as { governmentLogo?: string } | undefined)?.governmentLogo ??
                governmentLogoImage
              }
              titleBn={String(school?.name?.bn ?? '')}
              titleEn={String(school?.name?.en ?? '')}
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
