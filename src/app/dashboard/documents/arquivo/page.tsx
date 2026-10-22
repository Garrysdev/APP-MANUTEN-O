import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listDocRecords, listDocuments } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import ArchiveClient from './ArchiveClient'

export const metadata = {
  title: 'Arquivo de FR/IT | RG Maintenance',
}

export default async function DocumentArchivePage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'documents')) redirect('/dashboard/billing?feature=documents')

  const [records, docs] = await Promise.all([
    listDocRecords(profile.companyId),
    listDocuments(profile.companyId),
  ])
  const docInfo = Object.fromEntries(docs.map((d) => [d.id, { code: d.code || '', title: d.title }]))

  return <ArchiveClient records={records} docInfo={docInfo} />
}
