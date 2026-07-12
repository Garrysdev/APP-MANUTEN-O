import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import ProfileClient from './ProfileClient'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">O meu perfil</h1>
      <p className="text-sm text-gray-500 mb-6">{profile.email}</p>
      <ProfileClient profile={profile} />
    </div>
  )
}
