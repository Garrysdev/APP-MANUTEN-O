import { getInviteByToken, getCompanyName } from '@/lib/firebase/data'
import RegisterForm from './RegisterForm'

export const dynamic = 'force-dynamic'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; email?: string }>
}) {
  const params = await searchParams
  const inviteToken = params.invite ?? null
  const inviteEmail = params.email ? decodeURIComponent(params.email) : null

  let inviteCompanyName: string | null = null
  let inviteRole: string | null = null

  if (inviteToken) {
    try {
      const invite = await getInviteByToken(inviteToken)
      if (invite) {
        inviteCompanyName = await getCompanyName(invite.companyId)
        inviteRole = invite.role
      }
    } catch {
      // token inválido ou Firebase não configurado — mostra form normal
    }
  }

  return (
    <RegisterForm
      inviteToken={inviteToken}
      inviteCompanyName={inviteCompanyName}
      inviteRole={inviteRole}
      inviteEmail={inviteEmail}
    />
  )
}
