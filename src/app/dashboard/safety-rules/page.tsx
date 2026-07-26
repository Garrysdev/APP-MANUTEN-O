import { getCurrentProfile } from '@/lib/firebase/session'
import { redirect } from 'next/navigation'
import { listSafetyRules } from '@/lib/firebase/data'
import SafetyRulesClient from './SafetyRulesClient'

export const metadata = {
  title: 'Itens de Segurança | RG Maintenance',
}

export default async function SafetyRulesPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') redirect('/dashboard')

  const rules = await listSafetyRules(profile.companyId)

  return <SafetyRulesClient initialRules={rules} />
}
