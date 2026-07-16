'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopHeader from '@/components/layout/TopHeader'

interface LayoutShellProps {
  user: {
    name: string
    role: string
    avatarUrl?: string | null
    company?: { name: string; plan?: string } | null
    language?: string
  }
  children: React.ReactNode
}

export default function LayoutShell({ user, children }: LayoutShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      <Sidebar user={user} open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <TopHeader user={user} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-[1440px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </>
  )
}
