'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopHeader from '@/components/layout/TopHeader'
import { BrandingProvider } from '@/components/providers/BrandingProvider'

interface LayoutShellProps {
  user: {
    name: string
    role: string
    avatarUrl?: string | null
    company?: { name: string; plan?: string; logoUrl?: string | null } | null
    language?: string
  }
  children: React.ReactNode
}

export default function LayoutShell({ user, children }: LayoutShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const branding = { companyName: user.company?.name ?? null, logoUrl: user.company?.logoUrl ?? null, userName: user.name }

  return (
    <BrandingProvider value={branding}>
      <Sidebar user={user} open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <TopHeader user={user} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-[1440px] mx-auto w-full">
            {/* Cabeçalho só na impressão (Imprimir / Guardar PDF das listas e relatórios) */}
            {branding.logoUrl && (
              <div className="hidden print:flex items-center justify-between border-b border-slate-300 pb-2 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={branding.logoUrl} alt={branding.companyName ?? ''} className="h-12 w-auto object-contain" />
                <span className="text-xs text-slate-500">{branding.companyName}</span>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </BrandingProvider>
  )
}
