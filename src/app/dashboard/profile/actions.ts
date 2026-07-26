'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { updateUserProfile } from '@/lib/firebase/data'

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

  try {
    await updateUserProfile(profile.id, { 
      name, 
      ...(abbreviation !== undefined ? { abbreviation } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(language !== undefined ? { language } : {})
    })
    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar perfil.' }
  }
}
