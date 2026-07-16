import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listStockItems } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import StocksClient from './StocksClient'

export const dynamic = 'force-dynamic'

export default async function StocksPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName

  const items = await listStockItems(profile.companyId)

  return (
    <div className="max-w-5xl mx-auto">
      <StocksClient items={items} plan={plan} />
    </div>
  )
}
