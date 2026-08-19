import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssetRefs, listUsers, listStockItems } from '@/lib/firebase/data'
import NewTaskPageClient from './NewTaskPageClient'

export const dynamic = 'force-dynamic'

export default async function NewTaskPage() {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/login')
  }

  const isManager = profile.role === 'manager'

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

  return (
    <NewTaskPageClient
      assets={assets}
      users={users}
      stockRefs={stockRefs}
      isManager={isManager}
    />
  )
}
