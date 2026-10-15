'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile, DEMO_COMPANY_ID } from '@/lib/firebase/session'
import { updateUserProfile, updateCompany } from '@/lib/firebase/data'
import { adminAuth } from '@/lib/firebase/admin'

export type ProfileFormState = { error?: string; ok?: boolean }

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

  const name = String(formData.get('name') ?? '').trim()
  if (!name || name.length < 2) return { error: 'Nome inválido (mínimo 2 caracteres).' }

  const avatarUrl = formData.has('avatarUrl')
    ? String(formData.get('avatarUrl') ?? '').trim() || null
    : undefined

  const abbreviationRaw = formData.get('abbreviation')
  const abbreviation = abbreviationRaw !== null ? String(abbreviationRaw).trim().toUpperCase() || null : undefined

  const languageRaw = formData.get('language')
  const language = languageRaw ? String(languageRaw) as 'pt' | 'en' | 'es' | 'fr' : undefined

  const emailRaw = formData.get('email')
  const email = emailRaw ? String(emailRaw).trim().toLowerCase() : undefined

  const phoneRaw = formData.get('phone')
  const phone = phoneRaw !== null ? String(phoneRaw).trim() || null : undefined

  try {
    if (email && email !== profile.email) {
      try {
        await adminAuth().updateUser(profile.id, { email })
      } catch (authErr) {
        console.warn('[updateProfileAction] Auth email update fallback:', authErr)
      }
    }

    await updateUserProfile(profile.id, { 
      name, 
      companyId: profile.companyId || DEMO_COMPANY_ID,
      ...(email ? { email } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(abbreviation !== undefined ? { abbreviation } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(language !== undefined ? { language } : {})
    })
    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/users')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar perfil.' }
  }
}

/**
 * Nome e logótipo da empresa — só o Gestor pode alterar (pedido do Rui, Out/2026):
 * "o Gestor tem que conseguir no seu perfil criar o nome da empresa e importar o logo".
 */
export async function updateCompanyAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }

  const name = String(formData.get('companyName') ?? '').trim()
  if (!name || name.length < 2) return { error: 'Nome da empresa inválido (mínimo 2 caracteres).' }

  const logoUrl = formData.has('logoUrl')
    ? String(formData.get('logoUrl') ?? '').trim() || null
    : undefined

  try {
    await updateCompany(profile.companyId || DEMO_COMPANY_ID, {
      name,
      ...(logoUrl !== undefined ? { logoUrl } : {}),
    })
    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar a empresa.' }
  }
}

export async function changeUserPasswordAction(newPassword: string): Promise<ProfileFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (!newPassword || newPassword.length < 6) return { error: 'A password deve ter pelo menos 6 caracteres.' }

  try {
    try {
      await adminAuth().updateUser(profile.id, { password: newPassword })
    } catch { /* fallback */ }
    await updateUserProfile(profile.id, { mustChangePassword: false })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/profile')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao alterar password.' }
  }
}

export async function updatePushSubscriptionAction(subscription: any): Promise<ProfileFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  try {
    await updateUserProfile(profile.id, { pushSubscription: subscription })
    revalidatePath('/dashboard/profile')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao guardar subscrição.' }
  }
}
