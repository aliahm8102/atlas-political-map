import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.ATLAS_NEXT_DIST_DIR || ".next",
  async headers() {
    return [...["/workspace/:path*", "/auth/:path*", "/login", "/demo"].map(source => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] })), {
      source: "/sw.js",
      headers: [
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    }];
  },
};

export default nextConfig;
