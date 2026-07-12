import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import Sidebar from '@/components/layout/Sidebar'
import TopHeader from '@/components/layout/TopHeader'
import { LanguageProvider } from '@/components/providers/LanguageProvider'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/api/auth/logout')

  const userForHeader = {
    name: profile.name,
    role: profile.role,
    avatarUrl: profile.avatarUrl ?? null,
    company: profile.company
      ? { name: profile.company.name, plan: profile.company.plan }
      : null,
    language: profile.language
  }

  return (
    <div className="flex h-screen bg-background transition-colors">
      <LanguageProvider lang={profile.language || 'pt'}>
        <Sidebar user={userForHeader} />
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <TopHeader user={userForHeader} />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-[1440px] mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </LanguageProvider>
    </div>
  )
}
