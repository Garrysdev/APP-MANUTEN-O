import { getCurrentProfile } from '@/lib/firebase/session'
import { redirect } from 'next/navigation'
import GlobalAIClient from './GlobalAIClient'

export const metadata = {
  title: 'Consultor IA | RG Maintenance',
}

export default async function AIPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const hasAiModule = true
  const aiCredits = profile.company?.aiCredits ?? 1000

  return <GlobalAIClient hasAiModule={hasAiModule} aiCredits={aiCredits} />
}
