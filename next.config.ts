import type { NextConfig } from 'next'
import withPWA from '@ducanh2912/next-pwa'

const nextConfig: NextConfig = {
  // Identificador único do build, lido pelo OfflineProvider para purgar a cache do PWA
  // sempre que há um deploy novo. No Vercel usa o commit; localmente, a hora do build.
  env: {
    NEXT_PUBLIC_BUILD_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
        ],
      },
    ]
  },
}

export default withPWA({
  dest: 'public',
  customWorkerSrc: 'worker',
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)
