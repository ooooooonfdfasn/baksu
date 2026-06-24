import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const githubPagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/baksu/hasik";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.17"],
  reactStrictMode: true,
  ...(isGithubPages
    ? {
        assetPrefix: `${githubPagesBasePath}/`,
        basePath: githubPagesBasePath,
        images: {
          unoptimized: true
        },
        output: "export" as const,
        trailingSlash: true
      }
    : {})
};

export default nextConfig;
