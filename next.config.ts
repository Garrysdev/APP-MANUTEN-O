import type { NextConfig } from 'next'
import withPWA from '@ducanh2912/next-pwa'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
}

export default withPWA({
  dest: 'public',
  customWorkerSrc: 'worker',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)
