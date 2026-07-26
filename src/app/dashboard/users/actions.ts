'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { createUserDirect, deactivateUser, countActiveUsers, countPendingInvites, createInviteToken, updateUserRate } from '@/lib/firebase/data'
import { LIMITS } from '@/lib/plans'
import type { UserRole, PlanName } from '@/types/models'

export type UserActionState = { error?: string; ok?: boolean }

export async function createUserDirectAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }

  const plan = (profile.company?.plan ?? 'free') as PlanName
  const activeCount = await countActiveUsers(profile.companyId)
  const pendingCount = await countPendingInvites(profile.companyId)
  const { maxUsers } = LIMITS[plan]
  if (activeCount + pendingCount >= maxUsers) {
    return {
      error: `Limite de ${maxUsers} utilizador(es) atingido no plano ${plan} (Ativos: ${activeCount}, Convites pendentes: ${pendingCount}). Faz upgrade para adicionar mais.`,
    }
  }

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const role = String(formData.get('role') ?? 'technician') as UserRole
  const tempPassword = String(formData.get('tempPassword') ?? '').trim()
  const avatarUrl = String(formData.get('avatarUrl') ?? '').trim() || null
  const specialty = String(formData.get('specialty') ?? '').trim() || null
  const abbreviation = String(formData.get('abbreviation') ?? '').trim().toUpperCase() || null

  if (!name || !email || !tempPassword) return { error: 'Preenche todos os campos.' }
  if (tempPassword.length < 6) return { error: 'A password deve ter pelo menos 6 caracteres.' }

  try {
    await createUserDirect(profile.companyId, { email, name, role, tempPassword, avatarUrl, specialty, abbreviation })
    revalidatePath('/dashboard/users')
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('email-already-exists') || msg.includes('already exists')) {
      return { error: 'Este e-mail já está registado.' }
    }
    return { error: msg || 'Erro ao criar utilizador.' }
  }
}

export async function generateInviteAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState & { inviteUrl?: string }> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }

  const plan = (profile.company?.plan ?? 'free') as PlanName
  const activeCount = await countActiveUsers(profile.companyId)
  const pendingCount = await countPendingInvites(profile.companyId)
  const { maxUsers } = LIMITS[plan]
  if (activeCount + pendingCount >= maxUsers) {
    return {
      error: `Limite de ${maxUsers} utilizador(es) atingido no plano ${plan} (Ativos: ${activeCount}, Convites pendentes: ${pendingCount}). Faz upgrade para poder gerar mais convites.`,
    }
  }

  const role = String(formData.get('role') ?? 'technician') as UserRole
  const email = String(formData.get('email') ?? '').trim().toLowerCase() || undefined
  try {
    const { token } = await createInviteToken(profile.companyId, role, email)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rg-maintenance.vercel.app'
    const emailParam = email ? `&email=${encodeURIComponent(email)}` : ''
    const inviteUrl = `${baseUrl}/register?invite=${token}${emailParam}`
    return { ok: true, inviteUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao gerar convite.' }
  }
}

export async function deactivateUserAction(userId: string): Promise<UserActionState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  if (userId === profile.id) return { error: 'Não podes desativar a tua própria conta.' }

  try {
    await deactivateUser(profile.companyId, userId)
    revalidatePath('/dashboard/users')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao desativar utilizador.' }
  }
}

export async function updateUserRateAction(userId: string, hourlyRate: number): Promise<UserActionState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }

  try {
    await updateUserRate(profile.companyId, userId, hourlyRate)
    revalidatePath('/dashboard/users')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar custo.' }
  }
}

import { updateUserProfile, updateTechnicianTypes } from '@/lib/firebase/data'
import { adminAuth } from '@/lib/firebase/admin'

export async function updateTechnicianTypesAction(types: string[]): Promise<UserActionState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }

  try {
    await updateTechnicianTypes(profile.companyId, types)
    revalidatePath('/dashboard/users')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar tipos de técnico.' }
  }
}

export async function updateUserByManagerAction(
  userId: string,
  formData: FormData
): Promise<UserActionState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }

  const name = String(formData.get('name') ?? '').trim()
  if (!name || name.length < 2) return { error: 'Nome inválido (mínimo 2 caracteres).' }

  const emailRaw = String(formData.get('email') ?? '').trim()
  const languageRaw = formData.get('language')
  const language = languageRaw ? String(languageRaw) as 'pt' | 'en' | 'es' | 'fr' : undefined
  
  const roleRaw = formData.get('role')
  const role = roleRaw ? String(roleRaw) as UserRole : undefined

  const specialtyRaw = formData.get('specialty')
  const specialty = specialtyRaw !== null ? String(specialtyRaw).trim() || null : undefined

  const abbreviationRaw = formData.get('abbreviation')
  const abbreviation = abbreviationRaw !== null ? String(abbreviationRaw).trim().toUpperCase() || null : undefined

  const avatarUrl = formData.has('avatarUrl')
    ? String(formData.get('avatarUrl') ?? '').trim() || null
    : undefined

  try {
    const updateData: any = { name }
    if (language) updateData.language = language
    if (role && userId !== profile.id) updateData.role = role
    if (specialty !== undefined) updateData.specialty = specialty
    if (abbreviation !== undefined) updateData.abbreviation = abbreviation
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl

    // Se o email foi fornecido e é válido, atualiza no Firebase Auth (se mudou) e no Firestore
    if (emailRaw && emailRaw.includes('@')) {
      try {
        const authUser = await adminAuth().getUser(userId).catch(() => null)
        if (authUser && authUser.email?.toLowerCase() !== emailRaw.toLowerCase()) {
          await adminAuth().updateUser(userId, { email: emailRaw })
        }
        updateData.email = emailRaw
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-exists') {
          return { error: 'Este e-mail já está a ser utilizado por outra conta.' }
        }
        // Se for user fallback ou sem conta no Auth, atualiza no Firestore sem travar
        updateData.email = emailRaw
      }
    }

    await updateUserProfile(userId, updateData)
    revalidatePath('/dashboard/users')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar perfil do utilizador.' }
  }
}
