import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getStockItem, listStockMovements, listMaterialsByName } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import StockDetailClient from './StockDetailClient'

export const dynamic = 'force-dynamic'

export default async function StockItemPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'stocks')) redirect('/dashboard')

  const item = await getStockItem(profile.companyId, params.id)
  if (!item) notFound()

  const movements = await listStockMovements(profile.companyId, params.id)
  const usages = await listMaterialsByName(profile.companyId, item.name)

  return <StockDetailClient item={item} movements={movements} usages={usages} />
}
