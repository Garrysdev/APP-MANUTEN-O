'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listDocuments, createDocument, updateDocument, deleteDocument } from '@/lib/firebase/data'
import { LIMITS } from '@/lib/plans'
import type { PlanName } from '@/types/models'
import { readFrLayout } from '@/lib/fr-layout'
import { readDocumentFile, importKind, type DocumentImport } from '@/lib/document-import'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const MAX_LAYOUT_CHARS = 200_000

// Estrutura enviada pelo browser (vinda de parseFrFileAction): só aceitar JSON válido e de
// tamanho razoável — fica gravada no documento e é desenhada para toda a empresa.
function parseLayoutJson(formData: FormData): string | null | undefined {
  if (!formData.has('layoutJson')) return undefined
  const raw = String(formData.get('layoutJson') ?? '')
  if (!raw || raw.length > MAX_LAYOUT_CHARS) return null
  const layout = readFrLayout(raw)
  return layout ? JSON.stringify(layout) : null
}

/**
 * Lê um ficheiro de FR/IT já carregado no Cloudinary (Word, Excel ou PDF) e devolve o que
 * se consegue preencher automaticamente: estrutura (cópia fiel), campos, título, código e
 * texto. Imagens e formatos desconhecidos: nada (o original vê-se tal e qual).
 */
export async function parseDocumentFileAction(
  fileUrl: string,
  fileName: string
): Promise<Partial<DocumentImport> & { error?: string }> {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }
  const url = safeFileUrl(fileUrl)
  if (!url) return { error: 'Ficheiro inválido.' }
  const name = importKind(fileName) ? fileName : url
  if (!importKind(name)) return {}

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return { error: `Não foi possível ler o ficheiro (${res.status}).` }
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > MAX_IMPORT_BYTES) return { error: 'Ficheiro demasiado grande para ler o conteúdo (máx. 10 MB).' }
    return await readDocumentFile(bytes, name)
  } catch (err) {
    console.error('[parseDocumentFileAction] Erro a ler o ficheiro:', err)
    return { error: 'Não foi possível ler o conteúdo do ficheiro.' }
  }
}

// O URL vai para um <a href> visto por toda a empresa: só aceitar ficheiros carregados
// pela app (Cloudinary, https) — nunca javascript:/data: ou sites externos.
function safeFileUrl(raw: FormDataEntryValue | null): string | null {
  const url = String(raw ?? '').trim()
  return /^https:\/\/res\.cloudinary\.com\//.test(url) ? url : null
}

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
  // Ficheiro importado: obrigatório em MANUAL, opcional em FR/IT.
  const fileUrl = safeFileUrl(formData.get('fileUrl'))
  const fileName = fileUrl ? (String(formData.get('fileName') ?? '').trim() || null) : null
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
    layoutJson: type !== 'MANUAL' ? (parseLayoutJson(formData) ?? null) : null,
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
  const fileUrl = fileUrlRaw !== null ? safeFileUrl(fileUrlRaw) : undefined
  const fileNameRaw = formData.get('fileName')
  const fileName = fileNameRaw !== null ? (String(fileNameRaw).trim() || null) : undefined
  const layoutJson = type !== 'MANUAL' ? parseLayoutJson(formData) : undefined

  await updateDocument(profile.companyId, id, {
    ...(layoutJson !== undefined ? { layoutJson } : {}),
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
