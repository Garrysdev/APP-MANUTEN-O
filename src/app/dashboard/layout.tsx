import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import LayoutShell from '@/components/layout/LayoutShell'
import { LanguageProvider } from '@/components/providers/LanguageProvider'
import MustChangePasswordBanner from '@/components/ui/MustChangePasswordBanner'

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
        <MustChangePasswordBanner mustChange={profile.mustChangePassword} />
        <LayoutShell user={userForHeader}>
          {children}
        </LayoutShell>
      </LanguageProvider>
    </div>
  )
}
