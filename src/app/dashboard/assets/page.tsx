import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssets } from '@/lib/firebase/data'
import AssetsClient from './AssetsClient'

export const dynamic = 'force-dynamic'

export default async function AssetsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'technician') redirect('/dashboard/tasks')

  const assets = await listAssets(profile.companyId)
  const plan = (profile.company?.plan ?? 'free') as any
  return <AssetsClient assets={assets} plan={plan} />
}
