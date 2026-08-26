import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listMaintenancePlans, listAssetRefs, listUsers } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import MaintenancePlanClient from './MaintenancePlanClient'

export const dynamic = 'force-dynamic'

export default async function MaintenancePlanPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'maintenance-plan')) redirect('/dashboard/billing?feature=maintenance-plan')

  const [plans, assets, users] = await Promise.all([
    listMaintenancePlans(profile.companyId),
    listAssetRefs(profile.companyId),
    listUsers(profile.companyId),
  ])

  return (
    <div className="w-full">
      <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-slate-100">Plano de Manutenção</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Define tarefas recorrentes com periodicidade, equipamento e regras de segurança.
        </p>
      </div>
      <MaintenancePlanClient
        plans={plans}
        assets={assets}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        plan={plan}
      />
    </div>
  )
}
