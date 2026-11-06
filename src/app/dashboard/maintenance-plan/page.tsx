import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listMaintenancePlans, listAssetRefs, listUsers, listTasks, listExternalCompanies } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName, ExternalCompany } from '@/types/models'
import MaintenancePlanClient from './MaintenancePlanClient'

export const dynamic = 'force-dynamic'

const KEEP_TEST_EMAILS = new Set(['tecnico@teste.rg'])

type PickerCandidate = {
  id: string
  name?: string | null
  role?: string | null
  email?: string | null
  companyId?: string | null
  isExternal?: boolean
  externalCompanyId?: string | null
  externalCompanyName?: string | null
}

function isExternalCandidate(u: PickerCandidate): boolean {
  return Boolean(u.isExternal || (u.externalCompanyName && u.externalCompanyName.trim()) || u.role === 'external')
}

/** Mesma regra da página Equipa (UsersClient): o técnico externo pertence a uma empresa registada. */
function belongsToExternalCompany(u: PickerCandidate, companies: ExternalCompany[]): boolean {
  const compName = (u.externalCompanyName || '').toLowerCase()
  return companies.some((c) => u.externalCompanyId === c.id || (!!c.name && compName.includes(c.name.toLowerCase())))
}

/**
 * Fora da lista de técnicos do PM (pedidos do Rui, 05/11/2026) — a lista é a da página Equipa:
 * - gestores (nem o próprio Rui: a supervisão vai para a conta de técnico dele, RuiG);
 * - contas de teste dos planos (seed-test, *@teste.rg) e de outras empresas de demo;
 * - técnicos externos sem uma empresa externa registada na Equipa.
 * A RuiG (tecnico@teste.rg) é o técnico de teste do telemóvel e fica.
 */
function hideFromTechPicker(u: PickerCandidate, companyId: string, companies: ExternalCompany[]): boolean {
  const email = String(u.email || '').toLowerCase().trim()
  if (KEEP_TEST_EMAILS.has(email)) return false
  if (u.role === 'manager') return true
  if (email.endsWith('@teste.rg')) return true
  if (u.companyId && u.companyId !== companyId) return true
  if (isExternalCandidate(u) && !belongsToExternalCompany(u, companies)) return true
  return false
}

export default async function MaintenancePlanPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'maintenance-plan')) redirect('/dashboard/billing?feature=maintenance-plan')

  const [plans, assets, users, tasks, externalCompanies] = await Promise.all([
    listMaintenancePlans(profile.companyId),
    listAssetRefs(profile.companyId),
    listUsers(profile.companyId),
    // Todas as OT (não só as 2000 mais recentes: com o histórico importado a OT de um
    // plano podia ficar de fora e o estado na tabela nunca mudava). Ao cliente só vão as
    // que findPlanLinkedTask pode ligar a um plano — por id do plano ou por TAG.
    listTasks(profile.companyId, 20000),
    listExternalCompanies(profile.companyId).catch(() => [] as ExternalCompany[]),
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
        users={users.map((u) => {
          const c = u as typeof u & { externalCompanyId?: string | null; externalCompanyName?: string | null }
          return {
            id: u.id,
            name: u.name,
            abbreviation: u.abbreviation || u.name,
            avatarUrl: u.avatarUrl,
            active: u.active,
            role: u.role,
            isExternal: u.isExternal,
            externalCompanyId: c.externalCompanyId,
            externalCompanyName: c.externalCompanyName,
            isTestAccount: hideFromTechPicker(c, profile.companyId, externalCompanies),
          }
        })}
        tasks={pmTasks}
        plan={plan}
      />
    </div>
  )
}
