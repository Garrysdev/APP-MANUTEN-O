import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listAssetRefs, listUsers } from '@/lib/firebase/data'
import ProjectsClient from './ProjectsClient'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const [allTasks, assets, users] = await Promise.all([
    listTasks(profile.companyId),
    listAssetRefs(profile.companyId),
    listUsers(profile.companyId),
  ])

  // Filtrar apenas tarefas da secção de projetos
  const projectTasks = allTasks.filter(
    (t) => (t as any).source === 'folha_projetos' || (t as any).isProject === true
  )

  const tasks = profile.role === 'technician'
    ? projectTasks.filter((t) => t.assignedTo === profile.id || t.createdBy === profile.id)
    : projectTasks

  return (
    <ProjectsClient
      tasks={tasks}
      assets={assets}
      users={users.map((u) => ({ id: u.id, name: u.name, abbreviation: u.abbreviation || u.name, avatarUrl: u.avatarUrl }))}
      role={profile.role}
      userId={profile.id}
    />
  )
}
