import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Auto-serve WebP/AVIF — typically 50-80% smaller than JPEG/PNG
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images on CDN for 24 hours
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/cart", destination: "/book", permanent: false },
      { source: "/checkout", destination: "/trip/confirm", permanent: false },
      { source: "/offers", destination: "/register?role=captain", permanent: false },
      { source: "/orders", destination: "/trips", permanent: false },
      { source: "/order-success", destination: "/trip/live", permanent: false },
      { source: "/contact", destination: "/support", permanent: false },
      { source: "/faq", destination: "/support", permanent: false },
      { source: "/categories", destination: "/book", permanent: false },
      { source: "/category/:slug*", destination: "/book/ride", permanent: false },
      { source: "/product/:slug*", destination: "/book/ride", permanent: false },
      { source: "/restaurants", destination: "/register?role=captain", permanent: false },
      { source: "/restaurant/:slug*", destination: "/register?role=captain", permanent: false },
    ];
  },
};

export default withPWA(nextConfig);
