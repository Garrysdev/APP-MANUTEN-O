import { getCurrentProfile } from '@/lib/firebase/session'
import { redirect } from 'next/navigation'
import ManualClient from './ManualClient'

export default async function ManualPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return <ManualClient />
}
