import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Point to the monorepo root to suppress the multiple lockfiles warning
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
