import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(projectRoot, "..");
const require = createRequire(import.meta.url);

// Dual deploy: same next.config for Vercel + OpenNext/Cloudflare.
// OpenNext sets OPEN_NEXT=1 via scripts/run-with-open-next.mjs.
const isOpenNextBuild = process.env.OPEN_NEXT === "1";

/**
 * Vercel (monorepo): trace from repo root so hoisted next/@swc/helpers land in /var/task.
 * OpenNext: do NOT set monorepo tracing root — client-next has its own package-lock, so
 * OpenNext's packagePath is "" and expects flat `.next/standalone/.next/...`. Nesting under
 * `client-next/` (via monorepo tracing root) breaks the CF build with missing pages-manifest.
 */
const vercelTracingIncludes = [
  "../node_modules/next/dist/**/*",
  "../node_modules/next/setup-node-env.js",
  "../node_modules/next/package.json",
  "../node_modules/next/node_modules/@swc/helpers/**/*",
  "../node_modules/@swc/helpers/**/*",
  "node_modules/next/dist/**/*",
  "node_modules/next/setup-node-env.js",
  "node_modules/next/node_modules/@swc/helpers/**/*",
  "node_modules/@swc/helpers/**/*",
];

const nextConfig: NextConfig = {
  output: "standalone",
  ...(isOpenNextBuild
    ? {
        // Flat standalone layout for OpenNext; next-build.mjs copies full next into it.
        outputFileTracingIncludes: {
          "/*": [
            "../node_modules/next/dist/**/*",
            "../node_modules/@swc/helpers/**/*",
            "node_modules/@swc/helpers/**/*",
          ],
        },
      }
    : {
        outputFileTracingRoot: monorepoRoot,
        outputFileTracingIncludes: {
          "/*": vercelTracingIncludes,
        },
      }),
  transpilePackages: ["@school/common-ui"],
  turbopack: {
    // Keep in sync with tracing root when set (Next warns if they diverge).
    root: isOpenNextBuild ? projectRoot : monorepoRoot,
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

// Keep OpenNext out of the Vercel production config graph — load only for local CF preview.
if (process.env.NODE_ENV === "development") {
  require("@opennextjs/cloudflare").initOpenNextCloudflareForDev();
}
