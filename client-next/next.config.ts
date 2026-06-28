import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./app/fonts/Kalpurush-v0.258.woff2"],
  },
  turbopack: {
    root: projectRoot,
  },
  images: {
    unoptimized: true,
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
