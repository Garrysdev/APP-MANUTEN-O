import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getAsset, listTasksByAsset, listUsers } from '@/lib/firebase/data'
import { isQuotaExhausted } from '@/lib/firebase/admin'
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
  let tasks: Awaited<ReturnType<typeof listTasksByAsset>>
  if (asset) {
    tasks = await listTasksByAsset(profile.companyId, id, asset.tag).catch(() => [])
  } else {
    // Sem equipamento com este id: pode ser um link por TAG (OTs antigas importadas
    // referem a TAG em texto, sem ficha de equipamento). Só mostra a página se ESTA
    // empresa tiver OTs com essa TAG — senão é um id desconhecido ou de outra empresa
    // (antes inventava sempre um equipamento a partir do endereço).
    const tagOrName = decodeURIComponent(id)
    tasks = await listTasksByAsset(profile.companyId, id, tagOrName).catch(() => [])
    // Com o Firestore em baixo não dá para saber se a TAG é desta empresa: mostra a
    // página (vazia) em vez de "Acesso não autorizado" para um link legítimo.
    if (tasks.length === 0 && !isQuotaExhausted()) notFound()
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

  return <AssetDetailClient asset={asset} tasks={tasks} users={users} />
}
