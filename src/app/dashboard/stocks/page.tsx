import { redirect } from 'next/navigation'
import { Boxes } from 'lucide-react'
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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Boxes className="h-6 w-6 text-[#2E86C1]" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Gestão de Stocks</h1>
      </div>
      <StocksClient items={items} plan={plan} />
    </div>
  )
}
