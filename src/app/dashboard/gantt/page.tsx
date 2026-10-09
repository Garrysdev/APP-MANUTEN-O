import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listAssetRefs, listUsers, listMaintenancePlans } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import { isProjectTask } from '@/lib/task-assignment'
import type { PlanName } from '@/types/models'
import GanttClient from './GanttClient'

export const dynamic = 'force-dynamic'

export default async function GanttPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'projects')) redirect('/dashboard/billing?feature=projects')

  const [allTasks, assets, users, plans] = await Promise.all([
    listTasks(profile.companyId),
    listAssetRefs(profile.companyId),
    listUsers(profile.companyId),
    listMaintenancePlans(profile.companyId),
  ])

  const tasks = allTasks.filter(isProjectTask)

  return (
    <GanttClient
      tasks={tasks}
      assets={assets}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        abbreviation: u.abbreviation || u.name,
        avatarUrl: u.avatarUrl,
        active: u.active,
        role: u.role,
        isExternal: u.isExternal,
        externalCompanyId: u.externalCompanyId,
        externalCompanyName: u.externalCompanyName,
      }))}
      plans={plans}
      role={profile.role}
      userId={profile.id}
    />
  )
}
