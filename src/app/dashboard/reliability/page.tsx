import { redirect } from 'next/navigation'
import { Activity } from 'lucide-react'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssets, listTasks, listInterventions } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import ReliabilityClient from './ReliabilityClient'

export const dynamic = 'force-dynamic'

export default async function ReliabilityPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'reliability')) redirect('/dashboard/billing?feature=reliability')

  const [assets, tasks, interventions] = await Promise.all([
    listAssets(profile.companyId),
    listTasks(profile.companyId),
    listInterventions(profile.companyId),
  ])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <Activity className="h-7 w-7 text-[#2E86C1]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Fiabilidade & Indicadores de Desempenho</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Evolução temporal e análise detalhada de MTBF, MTTR e Disponibilidade de todos os equipamentos.</p>
        </div>
      </div>
      
      <ReliabilityClient assets={assets} tasks={tasks} interventions={interventions} />
    </div>
  )
}
