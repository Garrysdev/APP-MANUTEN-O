import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listUsers } from '@/lib/firebase/data'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'technician') redirect('/dashboard/tasks')

  const users = await listUsers(profile.companyId)
  const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name, 'pt'))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Utilizadores</h1>
      <p className="text-sm text-gray-500 mb-6">
        {users.filter(u => u.active).length} ativos · {users.length} total
      </p>
      <UsersClient
        users={sorted}
        currentUserId={profile.id}
        isManager={profile.role === 'manager'}
      />
    </div>
  )
}
