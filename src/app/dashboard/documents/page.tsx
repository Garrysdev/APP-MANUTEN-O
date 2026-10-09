import { getCurrentProfile } from '@/lib/firebase/session'
import { redirect } from 'next/navigation'
import { listDocuments } from '@/lib/firebase/data'
import { planHas } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import DocumentsClient from './DocumentsClient'

export const metadata = {
  title: 'Gestão Documental | RG Maintenance',
}

export default async function DocumentsPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'documents')) redirect('/dashboard/billing?feature=documents')

  const docs = await listDocuments(profile.companyId)

  return <DocumentsClient initialDocs={docs} />
}
