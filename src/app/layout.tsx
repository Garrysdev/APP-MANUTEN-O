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
}

export const viewport: Viewport = {
  themeColor: '#1B4F72',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
