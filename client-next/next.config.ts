import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Dual deploy: same next.config for Vercel + OpenNext/Cloudflare.
// OpenNext sets OPEN_NEXT=1 via scripts/run-with-open-next.mjs.
const isOpenNextBuild = process.env.OPEN_NEXT === "1";

const nextConfig: NextConfig = {
  // Standalone + broad next/dist tracing are OpenNext-only.
  // On Vercel, including ../node_modules/next/dist/**/* without @swc/helpers
  // caused runtime 500s: Cannot find module '@swc/helpers/_/_interop_require_default'.
  ...(isOpenNextBuild
    ? {
        output: "standalone" as const,
        outputFileTracingIncludes: {
          "/*": [
            "../node_modules/next/dist/**/*",
            "../node_modules/next/node_modules/@swc/helpers/**/*",
            "../node_modules/@swc/helpers/**/*",
            "node_modules/@swc/helpers/**/*",
          ],
        },
      }
    : {}),
  transpilePackages: ["@school/common-ui"],
  turbopack: {
    root: projectRoot,
  },
  images: {
    // Cloudflare Images binding not enabled yet — skip optimizer on CF builds.
    ...(isOpenNextBuild ? { unoptimized: true } : {}),
    qualities: [50, 75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Link",
            value: "</bg.png>; rel=preload; as=image; fetchpriority=high",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const rewrites = [
      {
        source: "/favicon.ico",
        destination: "/favicon",
      },
    ];

    if (process.env.NODE_ENV !== "development") {
      return rewrites;
    }

    const tenantRouter =
      process.env.TENANT_ROUTER_URL?.replace(/\/+$/, "") ||
      "http://127.0.0.1:8787";

    return [
      ...rewrites,
      {
        source: "/api/:path*",
        destination: `${tenantRouter}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

// Cloudflare bindings for local `next dev` only — keep off Vercel builds.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
