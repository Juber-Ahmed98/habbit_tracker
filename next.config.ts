import type { NextConfig } from "next";
import path from "node:path";
import withSerwistInit from "@serwist/next";

// Serwist 9.x doesn't fully support Turbopack production builds yet
// (https://github.com/serwist/serwist/issues/54). The build script forces
// webpack via `next build --webpack`; dev stays on Turbopack since the SW
// is disabled in development anyway.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't crawl upward and mistake a
  // stray lockfile in the parent directory for ours.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default withSerwist(nextConfig);
