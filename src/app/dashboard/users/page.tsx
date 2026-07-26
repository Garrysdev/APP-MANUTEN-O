import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listUsers, getTechnicianTypes } from '@/lib/firebase/data'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'technician') redirect('/dashboard/tasks')

  const [users, technicianTypes] = await Promise.all([
    listUsers(profile.companyId),
    getTechnicianTypes(profile.companyId),
  ])
  const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name, 'pt'))

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-1">Utilizadores & Equipa</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
        {users.filter(u => u.active).length} ativos · {users.length} total
      </p>
      <UsersClient
        users={sorted}
        currentUserId={profile.id}
        isManager={profile.role === 'manager'}
        technicianTypes={technicianTypes}
      />
    </div>
  )
}
