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
  // false: recarregar a página inteira quando a rede volta fazia a app "reiniciar" (logo
  // incluído) ao regressar a ela no telemóvel. A sincronização offline já retoma sozinha.
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === 'development',
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // Abrir páginas (navegação): como a regra "pages" de origem, mas com rede lenta
        // (> 4 s) abre a última versão guardada em vez de ficar no ecrã do logo; o
        // AppResume pede logo os dados frescos. Limpa ao trocar de conta (replication.ts).
        urlPattern: ({ request, url: { pathname }, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) =>
          sameOrigin && request.mode === 'navigate' && !pathname.startsWith('/api/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-nav',
          expiration: { maxEntries: 32, maxAgeSeconds: 86400 },
          networkTimeoutSeconds: 4,
        },
      },
    ],
  },
})(nextConfig)
