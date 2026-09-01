import type { NextConfig } from 'next';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(projectRoot, '..');
const require = createRequire(import.meta.url);

// Dual deploy: same next.config for Vercel + OpenNext/Cloudflare.
// OpenNext sets OPEN_NEXT=1 via scripts/run-with-open-next.mjs.
const isOpenNextBuild = process.env.OPEN_NEXT === '1';

/**
 * Vercel (monorepo): trace from repo root so hoisted next/@swc/helpers land in /var/task.
 * OpenNext (pnpm monorepo): set outputFileTracingRoot so standalone output is nested at
 * `.next/standalone/client-next/.next/...`, which OpenNext resolves via getPackagePath().
 */
const vercelTracingIncludes = [
  '../node_modules/next/dist/**/*',
  '../node_modules/next/setup-node-env.js',
  '../node_modules/next/package.json',
  '../node_modules/next/node_modules/@swc/helpers/**/*',
  '../node_modules/@swc/helpers/**/*',
  'node_modules/next/dist/**/*',
  'node_modules/next/setup-node-env.js',
  'node_modules/next/node_modules/@swc/helpers/**/*',
  'node_modules/@swc/helpers/**/*',
];

const nextConfig: NextConfig = {
  // `output: "standalone"` is only needed by OpenNext/Cloudflare (it bundles the
  // standalone server itself). Vercel does its own tracing/packaging natively —
  // forcing standalone mode there makes Vercel's onBuildComplete step depend on
  // `.next/next-server.js.nft.json`, which Turbopack doesn't produce in that
  // shape (confirmed broken in production, 2026-08-15). Leaving it unset on
  // Vercel lets its native builder handle the monorepo trace, which also makes
  // Turbopack safe to use there.
  ...(isOpenNextBuild
    ? {
        output: 'standalone',
        outputFileTracingRoot: monorepoRoot,
        // Monorepo NFT includes for OpenNext esbuild bundle (next-build.mjs also copies full packages).
        outputFileTracingIncludes: {
          '/*': [
            '../node_modules/next/dist/**/*',
            '../node_modules/@swc/helpers/**/*',
            '../node_modules/styled-jsx/**/*',
            'node_modules/@swc/helpers/**/*',
            'node_modules/styled-jsx/**/*',
          ],
        },
      }
    : {
        outputFileTracingRoot: monorepoRoot,
        outputFileTracingIncludes: {
          '/*': vercelTracingIncludes,
        },
      }),
  transpilePackages: ['@school/common-ui'],
  turbopack: {
    // Keep in sync with tracing root when set (Next warns if they diverge).
    root: isOpenNextBuild ? projectRoot : monorepoRoot,
  },
  images: {
    // Prefer optimizer on Vercel. On OpenNext/CF, use unoptimized unless a
    // custom loader is configured — CF Images binding is not wired yet.
    // ...(isOpenNextBuild ? { unoptimized: true } : {}),
    unoptimized: true,
    // Slightly lower default quality reduces LCP bytes on both platforms.
    qualities: [45, 50, 75],
    formats: ['image/avif', 'image/webp'],
    // minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Link',
            value: '</bg.png>; rel=preload; as=image; fetchpriority=high',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/bg.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/logo.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/header.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
  async rewrites() {
    const rewrites = [
      {
        source: '/favicon.ico',
        destination: '/favicon',
      },
    ];

    if (process.env.NODE_ENV !== 'development') {
      return rewrites;
    }

    const tenantRouter =
      process.env.TENANT_ROUTER_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:8787';

    return [
      ...rewrites,
      {
        source: '/api/:path*',
        destination: `${tenantRouter}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

// Keep OpenNext out of the Vercel production config graph — load only for local CF preview.
if (process.env.NODE_ENV === 'development') {
  require('@opennextjs/cloudflare').initOpenNextCloudflareForDev();
}
