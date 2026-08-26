import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listUsers, getTechnicianTypes, listExternalCompanies } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'users')) redirect('/dashboard/billing?feature=users')

  const [usersRes, technicianTypesRes, externalCompaniesRes] = await Promise.all([
    listUsers(profile.companyId).catch(() => []),
    getTechnicianTypes(profile.companyId).catch(() => []),
    listExternalCompanies(profile.companyId).catch(() => []),
  ])

  const users = Array.isArray(usersRes) ? usersRes : []
  const technicianTypes = Array.isArray(technicianTypesRes) ? technicianTypesRes : []
  const externalCompanies = Array.isArray(externalCompaniesRes) ? externalCompaniesRes : []

  const sorted = [...users].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt'))

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-slate-100">Utilizadores, Equipa & Prestadores Externos</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {sorted.length} utilizadores em catálogo ({sorted.filter((u) => u.active).length} ativos) · {externalCompanies.length} empresas prestadoras de serviços
        </p>
      </div>
      <UsersClient
        users={sorted}
        currentUserId={profile.id}
        isManager={profile.role === 'manager'}
        technicianTypes={technicianTypes}
        externalCompanies={externalCompanies}
      />
    </div>
  )
}
