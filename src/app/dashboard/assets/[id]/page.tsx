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

  // Se o ativo não for encontrado no Firestore ou Fallback, cria um registo virtual dinâmico para NUNCA bloquear a navegação
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

  const [tasks, users] = await Promise.all([
    listTasksByAsset(profile.companyId, id).catch(() => []),
    listUsers(profile.companyId).catch(() => []),
  ])

  return <AssetDetailClient asset={asset} tasks={tasks} users={users} />
}
