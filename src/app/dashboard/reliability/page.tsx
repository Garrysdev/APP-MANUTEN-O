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

  const hasModule = profile.company?.activeModules?.includes('reliability-kpis')

  if (!hasModule) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full mb-6">
          <Lock className="h-12 w-12 text-[#2E86C1]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">Módulo de Fiabilidade Bloqueado</h1>
        <p className="text-gray-600 dark:text-slate-400 max-w-md mb-8">
          Esta funcionalidade requer o módulo <strong>Fiabilidade & KPIs</strong>. Calcula automaticamente o MTBF, MTTR e OEE dos teus equipamentos.
        </p>
        <Link 
          href="/dashboard/marketplace"
          className="btn-primary"
        >
          Visitar Loja de Módulos
        </Link>
      </div>
    )
  }

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
