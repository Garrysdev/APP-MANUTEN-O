import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listInterventions, listInterventionsByTechnician, listTasks, listAssets, listUsers, listMaterialsForInterventions } from '@/lib/firebase/data'
import HistoryClient from './HistoryClient'

export const dynamic = 'force-dynamic'

export default async function HistoryPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const isTechnician = profile.role === 'technician'

  const [interventions, tasks, assets, users] = await Promise.all([
    isTechnician
      ? listInterventionsByTechnician(profile.companyId, profile.id)
      : listInterventions(profile.companyId),
    listTasks(profile.companyId),
    listAssets(profile.companyId),
    listUsers(profile.companyId),
  ])

  const allMaterials = await listMaterialsForInterventions(
    profile.companyId,
    interventions.map((i) => i.id)
  )
  const assetMap = Object.fromEntries(assets.map((a) => [a.id, a.name]))
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))
  const userRefs = users.map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }))
  const assetRefs = assets.map((a) => ({ id: a.id, name: a.name }))

  return (
    <HistoryClient
      interventions={interventions}
      tasks={tasks}
      allMaterials={allMaterials}
      users={userRefs}
      assets={assetRefs}
      userMap={userMap}
      assetMap={assetMap}
      isTechnician={isTechnician}
    />
  )
}
