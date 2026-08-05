import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Dual deploy: same next.config for Vercel + OpenNext/Cloudflare.
const isOpenNextBuild = process.env.OPEN_NEXT === "1";

const nextConfig: NextConfig = {
  // Required by OpenNext/Cloudflare; Vercel ignores the standalone folder and is fine.
  output: "standalone",
  // Help NFT keep Next server internals for OpenNext's esbuild pass (monorepo hoist).
  outputFileTracingIncludes: {
    "/*": ["../node_modules/next/dist/**/*"],
  },
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

// Enables Cloudflare bindings during `next dev` when previewing dual-deploy setup.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
