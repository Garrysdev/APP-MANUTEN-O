import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssets } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import AssetsClient from './AssetsClient'

export const dynamic = 'force-dynamic'

export default async function AssetsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'assets')) redirect('/dashboard/billing?feature=assets')

  const assets = await listAssets(profile.companyId)
  return <AssetsClient assets={assets} plan={plan} />
}
