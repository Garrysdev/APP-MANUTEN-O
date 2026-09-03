import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'RG Maintenance',
  description: 'Plataforma de gestão de manutenção',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RG Maintenance',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#1B4F72',
  width: 'device-width',
  initialScale: 1,
}

import { OfflineProvider } from '@/components/providers/OfflineProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // translate="no" + .notranslate: a tradução automática do Chrome substitui nós de texto
  // por baixo do React. Como o React continua a guardar referências aos nós originais, ao
  // re-renderizar rebenta ("removeChild"/"insertBefore" em nós que já não existem) — o que
  // se vê como páginas a desformatar e formulários que deixam de gravar. A app já está em
  // português, por isso não se perde nada ao desligar a tradução.
  return (
    <html lang="pt" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <OfflineProvider>
            {children}
          </OfflineProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
