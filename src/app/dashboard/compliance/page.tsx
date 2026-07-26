import { getCurrentProfile } from '@/lib/firebase/session'
import { redirect } from 'next/navigation'
import ComplianceClient from './ComplianceClient'
import { planHas } from '@/lib/plans'

export const metadata = {
  title: 'Conformidade | RG Maintenance',
}

export default async function CompliancePage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') redirect('/dashboard')

  const plan = profile.company?.plan ?? 'free'
  if (!planHas(plan, 'compliance')) redirect('/dashboard/billing')

  return <ComplianceClient companyName={profile.company?.name ?? ''} />
}
