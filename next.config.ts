import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Production optimizations for smooth presentation playback
  compiler: {
    // Remove console.log in production for better performance
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  // Optimize images
  images: {
    formats: ["image/webp", "image/avif"],
  },
  // Enable SWC minification (default in Next.js 16)
  swcMinify: true,
};

export default nextConfig;
