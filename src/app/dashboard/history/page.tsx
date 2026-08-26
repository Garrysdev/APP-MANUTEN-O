import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function HistoryPage() {
  redirect('/dashboard/tasks?status=done')
}
