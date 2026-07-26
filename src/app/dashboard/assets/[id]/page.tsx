import { notFound } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getAsset, listTasksByAsset, listUsers } from '@/lib/firebase/data'
import AssetDetailClient from './AssetDetailClient'

export const dynamic = 'force-dynamic'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile) return notFound()

  const [asset, tasks, users] = await Promise.all([
    getAsset(profile.companyId, id),
    listTasksByAsset(profile.companyId, id),
    listUsers(profile.companyId),
  ])

  if (!asset) return notFound()

  return <AssetDetailClient asset={asset} tasks={tasks} users={users} />
}
