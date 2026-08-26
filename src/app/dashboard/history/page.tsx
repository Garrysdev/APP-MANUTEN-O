import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'

export const dynamic = 'force-dynamic'

export default async function HistoryPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  redirect('/dashboard/tasks?status=done,cancelled')
}
