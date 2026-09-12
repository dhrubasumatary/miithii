import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  agentRules: false,
  output: isDevelopment ? undefined : "export",
  ...(isDevelopment
    ? {
        async rewrites() {
          const voiceApiOrigin = process.env.MIITHII_VOICE_API_ORIGIN ?? "http://127.0.0.1:8788";
          return [{ source: "/api/:path*", destination: `${voiceApiOrigin}/api/:path*` }];
        }
      }
    : {}),
  reactStrictMode: true,
  transpilePackages: ["@miithii/ui"]
};

export default nextConfig;
