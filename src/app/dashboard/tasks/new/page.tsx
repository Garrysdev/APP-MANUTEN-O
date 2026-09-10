import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssetRefs, listUsers, listStockItems } from '@/lib/firebase/data'
import NewTaskPageClient from './NewTaskPageClient'

export const dynamic = 'force-dynamic'

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/login')
  }

  const roleStr = String(profile.role || '').toLowerCase().trim()
  const isManager = roleStr === 'manager' || roleStr === 'admin' || roleStr === 'gestor'
  if (!isManager) {
    redirect('/dashboard/tasks')
  }
  const params = await searchParams

  const [assets, users, stockItems] = await Promise.all([
    listAssetRefs(profile.companyId),
    listUsers(profile.companyId),
    listStockItems(profile.companyId),
  ])

  const stockRefs = stockItems.map((s: any) => ({
    id: s.id,
    name: s.name,
    unit: s.unit ?? null,
  }))

  const initialAssetId = typeof params.assetId === 'string' ? params.assetId : ''
  const initialTitle = typeof params.title === 'string' ? params.title : ''
  const initialDescription = typeof params.description === 'string' ? params.description : ''
  const initialTipo = typeof params.tipo === 'string' ? (params.tipo as any) : (params.ti ? (params.ti as any) : null)
  const initialPhotoUrl = typeof params.photoUrl === 'string' ? params.photoUrl : ''

  return (
    <NewTaskPageClient
      assets={assets}
      users={users}
      stockRefs={stockRefs}
      isManager={isManager}
      initialAssetId={initialAssetId}
      initialTitle={initialTitle}
      initialDescription={initialDescription}
      initialTipo={initialTipo}
      initialPhotoUrl={initialPhotoUrl}
    />
  )
}
