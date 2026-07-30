import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder + Supabase Storage (wheel-face images).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**", // This allows any path under the hostname
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  output: "standalone",
  transpilePackages: ["motion"],
  // Native binary module (chart rendering for Excel export) — must not be
  // bundled by webpack, only required at runtime on the server.
  serverExternalPackages: ["@napi-rs/canvas"],

  // ✅ Cache Headers - Reduce bandwidth by 75%
  // Only applied for production builds (`next start`) — in `next dev` these
  // chunk filenames are NOT content-hashed, so a 1-year "immutable" cache
  // would keep serving stale JS to the browser after every dev-server
  // restart, no matter what the source code says.
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable", // 1 year - images are immutable
          },
          {
            key: "CDN-Cache-Control",
            value: "max-age=31536000, immutable", // Vercel CDN cache 1 year
          },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable", // JS/CSS - forever
          },
        ],
      },
      {
        source: "/:path*.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.css",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // HTML pages - shorter cache for dynamic content
      {
        source: "/:path*",
        has: [{ type: "query", key: "spin" }],
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400", // 1 hour + 1 day stale
          },
        ],
      },
      // API routes - no cache
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
