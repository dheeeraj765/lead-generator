import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling puppeteer and its dependencies.
  // Without this, webpack tries to statically analyse puppeteer at build time,
  // which crashes on Vercel because there is no Chromium binary present.
  serverExternalPackages: [
    "puppeteer",
    "puppeteer-core",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
  ],
};

export default nextConfig;