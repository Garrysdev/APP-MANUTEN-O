import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getAsset, listTasksByAsset, listUsers } from '@/lib/firebase/data'
import AssetDetailClient from './AssetDetailClient'

export const dynamic = 'force-dynamic'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  // Busca paralela do equipamento e utilizadores para velocidade máxima
  const [assetRes, users] = await Promise.all([
    getAsset(profile.companyId, id).catch(() => null),
    listUsers(profile.companyId).catch(() => []),
  ])

  let asset = assetRes
  if (!asset) {
    const tagOrName = decodeURIComponent(id)
    const areaMatch = tagOrName.match(/^(\d+[A-Za-z0-9]*)/)
    asset = {
      id,
      companyId: profile.companyId,
      name: tagOrName,
      tag: tagOrName,
      area: areaMatch ? areaMatch[1] : 'Geral',
      active: true,
      createdAt: new Date().toISOString(),
    }
  }

  const tasks = await listTasksByAsset(profile.companyId, id, asset.tag).catch(() => [])

  return <AssetDetailClient asset={asset} tasks={tasks} users={users} />
}
