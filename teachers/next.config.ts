import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "**",
        port: "**",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "**",
        port: "**",
        pathname: "**",
      },
    ],
    domains: ["localhost"],
  },
};

export default nextConfig;
