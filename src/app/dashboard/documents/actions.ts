'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listDocuments, createDocument, updateDocument, deleteDocument } from '@/lib/firebase/data'
import { LIMITS } from '@/lib/plans'
import type { PlanName } from '@/types/models'

function parseFieldLabels(formData: FormData): string[] {
  return formData.getAll('fieldLabels').map((v) => String(v).trim()).filter(Boolean)
}

export async function createDocumentAction(formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }

  const type = String(formData.get('type') ?? '').trim() as 'FR' | 'IT'
  if (type !== 'FR' && type !== 'IT') return { error: 'Tipo de documento inválido.' }

  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { error: 'O título é obrigatório.' }
  const code = String(formData.get('code') ?? '').trim() || `${type}-${Date.now().toString().slice(-4)}`
  const content = String(formData.get('content') ?? '').trim() || null
  const category = String(formData.get('category') ?? 'Geral').trim()

  const plan = (profile.company?.plan ?? 'free') as PlanName
  const limits = LIMITS[plan] ?? LIMITS.free
  const maxForType = type === 'FR' ? limits.maxFRs : limits.maxITs
  const current = await listDocuments(profile.companyId, type)
  if (current.length >= maxForType) {
    const label = type === 'FR' ? 'Folha(s) de Registo' : 'Instrução(ões) de Trabalho'
    return { error: `Limite de ${maxForType} ${label} atingido no plano ${plan}. Faz upgrade para adicionar mais.` }
  }

  await createDocument(profile.companyId, {
    type,
    code,
    title,
    content,
    fieldLabels: type === 'FR' ? parseFieldLabels(formData) : null,
    category,
    active: true,
  })
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard/tasks')
  return { ok: true }
}

export async function updateDocumentAction(id: string, formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }

  const type = String(formData.get('type') ?? '').trim() as 'FR' | 'IT'
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { error: 'O título é obrigatório.' }
  const code = String(formData.get('code') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim() || null
  const category = String(formData.get('category') ?? 'Geral').trim()
  const active = formData.get('active') !== 'false'

  await updateDocument(profile.companyId, id, {
    code,
    title,
    content,
    fieldLabels: type === 'FR' ? parseFieldLabels(formData) : null,
    category,
    active,
  })
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard/tasks')
  return { ok: true }
}

export async function deleteDocumentAction(id: string) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }
  await deleteDocument(profile.companyId, id)
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard/tasks')
  return { ok: true }
}
