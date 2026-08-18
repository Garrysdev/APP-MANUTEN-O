import { listTasks, listAssets, listUsers } from '@/lib/firebase/data'
import { getCurrentProfile } from '@/lib/firebase/session'
import { redirect } from 'next/navigation'
import FinanceClient from './FinanceClient'
import { planHas } from '@/lib/plans'

export const metadata = {
  title: 'Financeiro | RG Maintenance',
}

export default async function FinancePage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = profile.company?.plan ?? 'free'
  if (!planHas(plan, 'finance')) redirect('/dashboard/billing')

  const tasks = await listTasks(profile.companyId)
  const assets = await listAssets(profile.companyId)
  const users = await listUsers(profile.companyId)

  return <FinanceClient tasks={tasks} assets={assets} users={users} />
}
