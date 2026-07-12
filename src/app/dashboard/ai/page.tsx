import { getCurrentProfile } from '@/lib/firebase/session'
import { redirect } from 'next/navigation'
import GlobalAIClient from './GlobalAIClient'

export const metadata = {
  title: 'Consultor IA | RG Maintenance',
}

export default async function AIPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const hasAiModule = profile.company?.activeModules?.includes('ai-consultant') ?? false
  const aiCredits = profile.company?.aiCredits ?? 0

  return <GlobalAIClient hasAiModule={hasAiModule} aiCredits={aiCredits} />
}
