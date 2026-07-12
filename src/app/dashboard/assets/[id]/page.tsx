import { notFound } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getAsset, listTasksByAsset, listUsers } from '@/lib/firebase/data'
import AssetDetailClient from './AssetDetailClient'

export const dynamic = 'force-dynamic'

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile()
  if (!profile) return notFound()

  const [asset, tasks, users] = await Promise.all([
    getAsset(profile.companyId, params.id),
    listTasksByAsset(profile.companyId, params.id),
    listUsers(profile.companyId),
  ])

  if (!asset) return notFound()

  return <AssetDetailClient asset={asset} tasks={tasks} users={users} />
}
