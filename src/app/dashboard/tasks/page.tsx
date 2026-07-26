import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listAssetRefs, listUsers } from '@/lib/firebase/data'
import TasksClient from './TasksClient'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  // Planos NÃO são carregados aqui — o cliente busca-os sob demanda ao abrir o modal (loadPlanTaskRefsAction).
  const [allTasks, assets, users] = await Promise.all([
    listTasks(profile.companyId),
    listAssetRefs(profile.companyId),
    listUsers(profile.companyId),
  ])

  const normalTasks = allTasks.filter(
    (t) =>
      (t as any).source !== 'folha_projetos' &&
      !(t as any).isProject &&
      !(t.description || '').toLowerCase().includes('projecto') &&
      !(t.description || '').toLowerCase().includes('projeto')
  )

  const tasks = profile.role === 'technician'
    ? normalTasks.filter((t) => t.assignedTo === profile.id || t.createdBy === profile.id)
    : normalTasks

  return (
    <TasksClient
      tasks={tasks}
      assets={assets}
      users={users.map((u) => ({ id: u.id, name: u.name, abbreviation: u.abbreviation || u.name, avatarUrl: u.avatarUrl }))}
      role={profile.role}
      userId={profile.id}
    />
  )
}
