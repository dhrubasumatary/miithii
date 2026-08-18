import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  transpilePackages: [
    "@miithii/auth",
    "@miithii/billing",
    "@miithii/db",
    "@miithii/llm-router",
    "@miithii/memory",
    "@miithii/ui",
    "@miithii/uploads"
  ]
};

export default nextConfig;
