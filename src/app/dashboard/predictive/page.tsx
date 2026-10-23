import { redirect } from 'next/navigation'
import { Gauge } from 'lucide-react'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssetRefs } from '@/lib/firebase/data'
import { listVibrationConfigs } from '@/lib/firebase/vibration-data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import PredictiveClient from './PredictiveClient'

export const dynamic = 'force-dynamic'

export default async function PredictivePage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'predictive')) redirect('/dashboard/billing?feature=predictive')

  const [assets, configs] = await Promise.all([
    listAssetRefs(profile.companyId),
    listVibrationConfigs(profile.companyId).catch(() => []),
  ])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <Gauge className="h-7 w-7 text-[#2E86C1]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Manutenção Preditiva</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Vibração e temperatura importadas em .csv — tendências, zonas ISO 10816-3 e alertas por equipamento.</p>
        </div>
      </div>

      <PredictiveClient assets={assets} configs={configs} />
    </div>
  )
}
