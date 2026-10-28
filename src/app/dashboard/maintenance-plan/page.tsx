import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listMaintenancePlans, listAssetRefs, listUsers, listTasks } from '@/lib/firebase/data'
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

  const [plans, assets, users, tasks] = await Promise.all([
    listMaintenancePlans(profile.companyId),
    listAssetRefs(profile.companyId),
    listUsers(profile.companyId),
    // Todas as OT (não só as 2000 mais recentes: com o histórico importado a OT de um
    // plano podia ficar de fora e o estado na tabela nunca mudava). Ao cliente só vão as
    // que findPlanLinkedTask pode ligar a um plano — por id do plano ou por TAG.
    listTasks(profile.companyId, 20000),
  ])
  const planTags = new Set(plans.map((p) => (p.tag || '').trim().toLowerCase()).filter(Boolean))
  const pmTasks = tasks.filter((t) => t.maintenancePlanId || (t.tag && planTags.has(t.tag.trim().toLowerCase())))

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
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          abbreviation: u.abbreviation || u.name,
          avatarUrl: u.avatarUrl,
          active: u.active,
          role: u.role,
          isExternal: u.isExternal,
          externalCompanyId: (u as any).externalCompanyId,
          externalCompanyName: (u as any).externalCompanyName,
        }))}
        tasks={pmTasks}
        plan={plan}
      />
    </div>
  )
}
