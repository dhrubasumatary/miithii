import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security: hide Next.js version header
  poweredByHeader: false,

  // Productiontrailing slash for consistent routing
  trailingSlash: true,

  // Image optimization domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.clerk.dev",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },

  // Environment variable exposure (public only)
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Headers for security
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // Redirects for common paths
  async redirects() {
    return [
      {
        source: "/chat",
        has: [{ type: "header", key: "x-app-router" }],
        destination: "/chat/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;