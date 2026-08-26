import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listInternalMessages, listUsers, listTasks } from '@/lib/firebase/data'
import MessagesClient from './MessagesClient'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const [messages, users, tasks] = await Promise.all([
    listInternalMessages(profile.companyId, profile.role === 'manager' ? undefined : profile.id),
    listUsers(profile.companyId),
    listTasks(profile.companyId),
  ])

  return (
    <MessagesClient
      messages={messages}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        abbreviation: u.abbreviation ?? null,
        role: u.role,
        active: u.active,
        isExternal: u.isExternal ?? false,
        avatarUrl: u.avatarUrl ?? null,
      }))}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        area: t.area || 'Geral',
        tag: t.tag || t.assetId || '—',
        status: t.status,
      }))}
      currentUserId={profile.id}
      currentUserName={profile.name}
      currentUserAbbr={profile.abbreviation ?? profile.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
      isManager={profile.role === 'manager'}
    />
  )
}
