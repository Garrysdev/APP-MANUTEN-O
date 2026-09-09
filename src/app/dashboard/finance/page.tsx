import { listTasks, listAssets, listUsers, listInterventions, listStockItems } from '@/lib/firebase/data'
import { getCurrentProfile } from '@/lib/firebase/session'
import { redirect } from 'next/navigation'
import FinanceClient from './FinanceClient'
import { planHas } from '@/lib/plans'

export const metadata = {
  title: 'Relatório Financeiro & Custos | RG Maintenance',
}

export const dynamic = 'force-dynamic'

export default async function FinancePage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = profile.company?.plan ?? 'free'
  if (!planHas(plan, 'finance')) redirect('/dashboard/billing')

  const [tasks, assets, users, interventions, stockItems] = await Promise.all([
    listTasks(profile.companyId),
    listAssets(profile.companyId),
    listUsers(profile.companyId),
    listInterventions(profile.companyId),
    listStockItems(profile.companyId),
  ])

  return (
    <FinanceClient
      tasks={tasks}
      assets={assets}
      users={users}
      interventions={interventions}
      stockItems={stockItems}
    />
  )
}
