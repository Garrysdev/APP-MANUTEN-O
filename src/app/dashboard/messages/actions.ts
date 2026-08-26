'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import {
  createInternalMessage,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/firebase/data'

export type MessageFormState = { error?: string; ok?: boolean; messageId?: string }

export async function sendInternalMessageAction(
  _prev: MessageFormState,
  formData: FormData
): Promise<MessageFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada. Efetue login novamente.' }

  const content = String(formData.get('content') ?? '').trim()
  if (!content) return { error: 'O conteúdo da mensagem é obrigatório.' }

  const recipientIdsRaw = String(formData.get('recipientIds') ?? '[]')
  let recipientIds: string[] = []
  try {
    recipientIds = JSON.parse(recipientIdsRaw)
  } catch {
    recipientIds = []
  }

  if (!recipientIds.length) {
    return { error: 'Selecione pelo menos um técnico ou "Todos os Técnicos".' }
  }

  const subject = String(formData.get('subject') ?? '').trim() || null
  const taskId = String(formData.get('taskId') ?? '').trim() || null
  const taskTitle = String(formData.get('taskTitle') ?? '').trim() || null
  const photoUrl = String(formData.get('photoUrl') ?? '').trim() || null
  const recipientNames = String(formData.get('recipientNames') ?? '').trim() || null

  try {
    const messageId = await createInternalMessage(profile.companyId, profile.id, {
      senderName: profile.name,
      senderAbbr: profile.abbreviation || profile.name.split(' ').map((n) => n[0]).join('').toUpperCase(),
      recipientIds,
      recipientNames,
      subject,
      content,
      taskId,
      taskTitle,
      photoUrl,
    })

    revalidatePath('/dashboard/messages')
    revalidatePath('/dashboard')
    return { ok: true, messageId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao enviar mensagem interna.' }
  }
}

export async function markNotificationReadAction(notificationId: string) {
  const profile = await getCurrentProfile()
  if (!profile) return
  await markNotificationRead(profile.companyId, notificationId)
  revalidatePath('/dashboard')
}

export async function markAllNotificationsReadAction() {
  const profile = await getCurrentProfile()
  if (!profile) return
  await markAllNotificationsRead(profile.companyId, profile.id)
  revalidatePath('/dashboard')
}
