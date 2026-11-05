import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listMaintenancePlans, listAssetRefs, listUsers, listTasks } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import MaintenancePlanClient from './MaintenancePlanClient'

export const dynamic = 'force-dynamic'

const KEEP_TEST_EMAILS = new Set(['tecnico@teste.rg'])

function isPlanTestAccount(
  u: { id: string; name?: string | null; role?: string | null; email?: string | null; companyId?: string | null },
  companyId: string,
): boolean {
  const email = String(u.email || '').toLowerCase().trim()
  if (KEEP_TEST_EMAILS.has(email)) return false
  // Gestores não são técnicos (pedido do Rui, 05/11/2026) — nem o próprio Rui: as tarefas de
  // supervisão atribuem-se à conta de técnico dele, RuiG (tecnico@teste.rg).
  if (u.role === 'manager') return true
  if (email.endsWith('@teste.rg')) return true
  // Utilizadores de outra empresa de demo (entram na lista da UR por isDemoCompany).
  return !!u.companyId && u.companyId !== companyId
}

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
          // Contas de teste dos planos (Free/Starter/QA Starter/RGB…, seed-test) e de outras
          // empresas de demo não são técnicos — ficam fora das listas de escolha (pedido do Rui, 05/11/2026).
          // A RuiG (tecnico@teste.rg) é o técnico de teste do telemóvel e fica.
          isTestAccount: isPlanTestAccount(u, profile.companyId),
        }))}
        tasks={pmTasks}
        plan={plan}
      />
    </div>
  )
}
