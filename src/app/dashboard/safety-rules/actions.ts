'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listSafetyRules, createSafetyRule, updateSafetyRule, deleteSafetyRule } from '@/lib/firebase/data'

export async function createSafetyRuleAction(formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { error: 'O título é obrigatório.' }
  const description = String(formData.get('description') ?? '').trim() || null
  const category = String(formData.get('category') ?? 'Geral').trim()

  await createSafetyRule(profile.companyId, {
    title,
    description,
    category,
    active: true,
  })
  revalidatePath('/dashboard/safety-rules')
  revalidatePath('/dashboard/tasks')
  return { ok: true }
}

export async function updateSafetyRuleAction(id: string, formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { error: 'O título é obrigatório.' }
  const description = String(formData.get('description') ?? '').trim() || null
  const category = String(formData.get('category') ?? 'Geral').trim()
  const active = formData.get('active') !== 'false'

  await updateSafetyRule(profile.companyId, id, {
    title,
    description,
    category,
    active,
  })
  revalidatePath('/dashboard/safety-rules')
  revalidatePath('/dashboard/tasks')
  return { ok: true }
}

export async function deleteSafetyRuleAction(id: string) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }
  await deleteSafetyRule(profile.companyId, id)
  revalidatePath('/dashboard/safety-rules')
  revalidatePath('/dashboard/tasks')
  return { ok: true }
}
