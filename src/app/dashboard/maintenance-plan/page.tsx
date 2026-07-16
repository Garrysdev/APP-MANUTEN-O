import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listMaintenancePlans, listAssetRefs, listUsers } from '@/lib/firebase/data'
import type { PlanName } from '@/types/models'
import MaintenancePlanClient from './MaintenancePlanClient'

export const dynamic = 'force-dynamic'

export default async function MaintenancePlanPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const plan = (profile.company?.plan ?? 'free') as PlanName

  const [plans, assets, users] = await Promise.all([
    listMaintenancePlans(profile.companyId),
    listAssetRefs(profile.companyId),
    listUsers(profile.companyId),
  ])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Plano de Manutenção</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Define tarefas recorrentes com periodicidade, equipamento e regras de segurança.
        </p>
      </div>
      <MaintenancePlanClient
        plans={plans}
        assets={assets.map((a) => ({ id: a.id, name: a.name }))}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        plan={plan}
      />
    </div>
  )
}
