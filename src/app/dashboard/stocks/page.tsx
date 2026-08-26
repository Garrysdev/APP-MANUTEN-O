import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listStockItems, listAssets } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import StocksClient from './StocksClient'

export const dynamic = 'force-dynamic'

export default async function StocksPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'stocks')) redirect('/dashboard/billing?feature=stocks')

  const [items, assets] = await Promise.all([
    listStockItems(profile.companyId),
    listAssets(profile.companyId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <StocksClient items={items} assets={assets} plan={plan} />
    </div>
  )
}
