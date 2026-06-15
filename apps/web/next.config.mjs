import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@logstack/shared-types"],
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },

  // CDN / static asset support for production (CloudFront, S3, etc.)
  // Set NEXT_PUBLIC_CDN_URL=https://your-cdn.example.com (no trailing slash)
  // to serve _next/static and other assets from CDN while the app runs on EC2 / origin.
  assetPrefix: process.env.NEXT_PUBLIC_CDN_URL || undefined,

  // next/image remote patterns (useful if you proxy or use external image hosts via CDN)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default withMDX(nextConfig);
