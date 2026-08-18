import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listUsers, getTechnicianTypes, listExternalCompanies } from '@/lib/firebase/data'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">Utilizadores, Equipa & Prestadores Externos</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
        {sorted.length} utilizadores em catálogo ({sorted.filter((u) => u.active).length} ativos) · {externalCompanies.length} empresas prestadoras de serviços
      </p>
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
