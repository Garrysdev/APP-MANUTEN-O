'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listDocuments, createDocument, updateDocument, deleteDocument } from '@/lib/firebase/data'
import { LIMITS } from '@/lib/plans'
import type { PlanName } from '@/types/models'

function parseFieldLabels(formData: FormData): string[] {
  return formData.getAll('fieldLabels').map((v) => String(v).trim()).filter(Boolean)
}

function maxForType(limits: ReturnType<typeof getLimits>, type: 'FR' | 'IT' | 'MANUAL'): number {
  if (type === 'FR') return limits.maxFRs
  if (type === 'IT') return limits.maxITs
  return limits.maxManuals
}

function getLimits(plan: PlanName) {
  return LIMITS[plan] ?? LIMITS.free
}

export async function createDocumentAction(formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }

  const type = String(formData.get('type') ?? '').trim() as 'FR' | 'IT' | 'MANUAL'
  if (type !== 'FR' && type !== 'IT' && type !== 'MANUAL') return { error: 'Tipo de documento inválido.' }

  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { error: 'O título é obrigatório.' }
  const code = String(formData.get('code') ?? '').trim() || `${type}-${Date.now().toString().slice(-4)}`
  const content = String(formData.get('content') ?? '').trim() || null
  const category = String(formData.get('category') ?? 'Geral').trim()
  const fileUrl = type === 'MANUAL' ? (String(formData.get('fileUrl') ?? '').trim() || null) : null
  const fileName = type === 'MANUAL' ? (String(formData.get('fileName') ?? '').trim() || null) : null
  if (type === 'MANUAL' && !fileUrl) return { error: 'É obrigatório anexar um ficheiro.' }

  const plan = (profile.company?.plan ?? 'free') as PlanName
  const limits = getLimits(plan)
  const limit = maxForType(limits, type)
  const current = await listDocuments(profile.companyId, type)
  if (current.length >= limit) {
    const label = type === 'FR' ? 'Folha(s) de Registo' : type === 'IT' ? 'Instrução(ões) de Trabalho' : 'Manual(ais)/Norma(s)'
    return { error: `Limite de ${limit} ${label} atingido no plano ${plan}. Faz upgrade para adicionar mais.` }
  }

  await createDocument(profile.companyId, {
    type,
    code,
    title,
    content,
    fieldLabels: type === 'FR' ? parseFieldLabels(formData) : null,
    category,
    active: true,
    fileUrl,
    fileName,
  })
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard/tasks')
  return { ok: true }
}

export async function updateDocumentAction(id: string, formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }

  const type = String(formData.get('type') ?? '').trim() as 'FR' | 'IT' | 'MANUAL'
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { error: 'O título é obrigatório.' }
  const code = String(formData.get('code') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim() || null
  const category = String(formData.get('category') ?? 'Geral').trim()
  const active = formData.get('active') !== 'false'
  const fileUrlRaw = formData.get('fileUrl')
  const fileUrl = fileUrlRaw !== null ? (String(fileUrlRaw).trim() || null) : undefined
  const fileNameRaw = formData.get('fileName')
  const fileName = fileNameRaw !== null ? (String(fileNameRaw).trim() || null) : undefined

  await updateDocument(profile.companyId, id, {
    code,
    title,
    content,
    fieldLabels: type === 'FR' ? parseFieldLabels(formData) : null,
    category,
    active,
    ...(fileUrl !== undefined ? { fileUrl } : {}),
    ...(fileName !== undefined ? { fileName } : {}),
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
