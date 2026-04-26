import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import NextBundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = NextBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false,
  output: 'standalone',
  devIndicators: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 640, 768, 1024, 1280, 1536],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '*.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      }
    ],
  },
  serverExternalPackages: [
    'playwright-core',
    '@sparticuz/chromium-min',
  ],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'lodash',
      'recharts',
      'xlsx',
    ],
    serverActions: {
      bodySizeLimit: '100mb',
    },
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    viewTransition: true,
  },
  turbopack: {},
};

export default withBundleAnalyzer(withSerwist(nextConfig));
