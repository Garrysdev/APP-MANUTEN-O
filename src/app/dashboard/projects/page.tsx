import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listAssetRefs, listUsers, listMaintenancePlans } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import ProjectsClient from './ProjectsClient'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName

  const [allTasks, assets, users, plans] = await Promise.all([
    listTasks(profile.companyId),
    listAssetRefs(profile.companyId),
    listUsers(profile.companyId),
    listMaintenancePlans(profile.companyId),
  ])

  // Filtrar apenas tarefas da secção de projetos ou associadas a planos
  const projectTasks = allTasks.filter(
    (t) =>
      (t as any).source === 'folha_projetos' ||
      (t as any).isProject === true ||
      (t.tipo as string) === 'projeto' ||
      (t.tipo as string) === 'projecto' ||
      (t.tipo as string) === 'pr' ||
      (t.description || '').toLowerCase().includes('projecto') ||
      (t.description || '').toLowerCase().includes('projeto')
  )

  const tasks = projectTasks

  return (
    <ProjectsClient
      tasks={tasks}
      assets={assets}
      users={users.map((u) => ({ id: u.id, name: u.name, abbreviation: u.abbreviation || u.name, avatarUrl: u.avatarUrl }))}
      plans={plans}
      role={profile.role}
      userId={profile.id}
    />
  )
}
