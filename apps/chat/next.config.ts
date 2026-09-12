import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  agentRules: false,
  output: isDevelopment ? undefined : "export",
  env: { NEXT_PUBLIC_API_BASE_URL: "" },
  ...(isDevelopment ? {
    async rewrites() {
      const apiOrigin = process.env.MIITHII_API_ORIGIN ?? "https://api.miithii.in";
      return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
    }
  } : {}),
  reactStrictMode: true,
  transpilePackages: ["@miithii/ui"]
};

export default nextConfig;
