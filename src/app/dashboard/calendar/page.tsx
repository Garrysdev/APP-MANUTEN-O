import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listMaintenancePlans, listAssets, listUsers } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import CalendarClient from './CalendarClient'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'technician') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'calendar')) redirect('/dashboard/billing')

  const [tasks, plans, assets, users] = await Promise.all([
    listTasks(profile.companyId),
    listMaintenancePlans(profile.companyId),
    listAssets(profile.companyId),
    listUsers(profile.companyId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendário</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tarefas por prazo e ocorrências do plano de manutenção.
        </p>
      </div>
      <CalendarClient
        tasks={tasks}
        plans={plans}
        assets={assets.map((a) => ({ id: a.id, name: a.name, tag: a.tag }))}
        users={users.map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl, active: u.active }))}
        role={profile.role}
        userId={profile.id}
      />
    </div>
  )
}
