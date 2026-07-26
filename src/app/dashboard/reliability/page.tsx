import { redirect } from 'next/navigation'
import { Activity, Lock } from 'lucide-react'
import Link from 'next/link'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssets, listTasks } from '@/lib/firebase/data'
import ReliabilityClient from './ReliabilityClient'

export const dynamic = 'force-dynamic'

export default async function ReliabilityPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const [assets, tasks] = await Promise.all([
    listAssets(profile.companyId),
    listTasks(profile.companyId)
  ])

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="h-6 w-6 text-[#2E86C1]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Fiabilidade & KPIs</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Análise de MTBF, MTTR e Disponibilidade dos equipamentos.</p>
        </div>
      </div>
      
      <ReliabilityClient assets={assets} tasks={tasks} />
    </div>
  )
}
