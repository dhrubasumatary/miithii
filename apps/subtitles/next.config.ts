import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "export",
  reactStrictMode: true,
  transpilePackages: ["@miithii/ui"]
};

export default nextConfig;
