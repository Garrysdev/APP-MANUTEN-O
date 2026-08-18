import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getAsset, listTasksByAsset, listUsers } from '@/lib/firebase/data'
import AssetDetailClient from './AssetDetailClient'

export const dynamic = 'force-dynamic'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  let asset = await getAsset(profile.companyId, id)

  // Se for 'varios' ou um equipamento virtual
  if (!asset && id === 'varios') {
    asset = {
      id: 'varios',
      companyId: profile.companyId,
      name: 'Vários Equipamentos / Transversal',
      tag: 'VÁRIOS',
      area: 'Geral',
      active: true,
      createdAt: new Date().toISOString(),
    }
  }

  if (!asset) redirect('/dashboard/assets')

  const [tasks, users] = await Promise.all([
    listTasksByAsset(profile.companyId, id).catch(() => []),
    listUsers(profile.companyId).catch(() => []),
  ])

  return <AssetDetailClient asset={asset} tasks={tasks} users={users} />
}
