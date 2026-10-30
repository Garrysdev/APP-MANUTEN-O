'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listDocuments, createDocument, updateDocument, deleteDocument } from '@/lib/firebase/data'
import { LIMITS, planHas } from '@/lib/plans'
import { rankDocuments, docSnippet } from '@/lib/doc-search'
import { normalizeDocCode, isValidDocCode, cleanDocTitle } from '@/lib/doc-code'
import type { PlanName } from '@/types/models'

// O URL vai para um <a href> visto por toda a empresa: só aceitar ficheiros carregados
// pela app (Cloudinary, https) — nunca javascript:/data: ou sites externos.
function safeFileUrl(raw: FormDataEntryValue | null): string | null {
  const url = String(raw ?? '').trim()
  return /^https:\/\/res\.cloudinary\.com\//.test(url) ? url : null
}

function checkCode(code: string, type: 'FR' | 'IT' | 'MANUAL'): string | null {
  if (type === 'MANUAL' || isValidDocCode(code, type)) return null
  return `A referência tem de ter o formato ${type === 'FR' ? 'FR-MAN-16' : 'IT-MAN-02'}.`
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

  const title = cleanDocTitle(formData.get('title'))
  if (!title) return { error: 'O título é obrigatório.' }
  const code = normalizeDocCode(formData.get('code')) || (type === 'MANUAL' ? `${type}-${Date.now().toString().slice(-4)}` : '')
  const codeError = checkCode(code, type)
  if (codeError) return { error: codeError }
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
  })
  revalidatePath('/dashboard/documents')
  revalidatePath('/dashboard/tasks')
  return { ok: true }
}

export async function updateDocumentAction(id: string, formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return { error: 'Sem permissão.' }

  const type = String(formData.get('type') ?? '').trim() as 'FR' | 'IT' | 'MANUAL'
  const title = cleanDocTitle(formData.get('title'))
  if (!title) return { error: 'O título é obrigatório.' }
  const code = normalizeDocCode(formData.get('code'))
  const codeError = checkCode(code, type)
  if (codeError) return { error: codeError }
  const content = String(formData.get('content') ?? '').trim() || null
  const category = String(formData.get('category') ?? 'Geral').trim()
  const active = formData.get('active') !== 'false'
  const fileUrlRaw = formData.get('fileUrl')
  const fileUrl = fileUrlRaw !== null ? safeFileUrl(fileUrlRaw) : undefined
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

export type DocAnswer = { response: string; sources: { id: string; code: string; title: string; fileUrl: string | null }[]; error?: string }

const DOC_TYPE_LABEL = { FR: 'Folha de Registo', IT: 'Instrução de Trabalho', MANUAL: 'Manual/Norma' } as const

/**
 * "Perguntar à IA" da Gestão Documental (substitui a antiga página Documentação/Base de
 * Conhecimento, que era só demonstração). Responde com base nos documentos reais da empresa
 * (FR, IT, Manuais & Normas): escolhe os que interessam à pergunta e, havendo modelo
 * configurado (GEMINI_API_KEY / OPENAI_API_KEY), pede-lhe a resposta só com esse contexto;
 * sem modelo, devolve os documentos encontrados com um excerto. Os PDFs não são lidos —
 * só código, título, categoria, campos e o texto do procedimento.
 */
export async function askDocumentsAction(question: string): Promise<DocAnswer> {
  const profile = await getCurrentProfile()
  if (!profile) return { response: '', sources: [], error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { response: '', sources: [], error: 'Sem permissão.' }
  if (!planHas((profile.company?.plan ?? 'free') as PlanName, 'aiConsultant')) {
    return { response: '', sources: [], error: 'A IA está disponível a partir do plano Business.' }
  }
  const q = String(question || '').trim().slice(0, 500)
  if (!q) return { response: '', sources: [], error: 'Escreve uma pergunta.' }

  try {
    const docs = await listDocuments(profile.companyId)
    const found = rankDocuments(docs, q)
    const sources = found.map((d) => ({ id: d.id, code: d.code, title: d.title, fileUrl: d.fileUrl || null }))
    const context = found
      .map((d) => [
        `[${d.code}] ${d.title} (${DOC_TYPE_LABEL[d.type]}${d.category ? `, ${d.category}` : ''})`,
        d.fieldLabels?.length ? `Campos: ${d.fieldLabels.join('; ')}` : '',
        d.content ? `Texto: ${d.content.slice(0, 3000)}` : '',
        d.fileName ? `Ficheiro: ${d.fileName}` : '',
      ].filter(Boolean).join('\n'))
      .join('\n\n')
    const system = `És o assistente da Gestão Documental da plataforma RG Maintenance (manutenção industrial, ISO 9001, NP EN 13306). Responde em português europeu, de forma clara e prática, com base nos documentos da empresa abaixo; cita a referência (ex.: [IT-MAN-02]) de onde vem cada informação. Se os documentos não tiverem a resposta, diz isso e indica o que procurar.

Documentos da empresa (${profile.company?.name ?? ''}):
${context || '(nenhum documento corresponde à pergunta)'}`

    const llm = await askLlm(system, q)
    if (llm) return { response: llm, sources }

    if (found.length === 0) {
      return { response: `Não encontrei nenhum documento ativo sobre isso (${docs.length} documentos na Gestão Documental). Tenta outras palavras — a referência (FR-MAN-…, IT-MAN-…) ou o nome do equipamento.`, sources }
    }
    const lines = found.slice(0, 6).map((d) => `• [${d.code}] ${d.title} — ${docSnippet(d, q)}`)
    return { response: `Encontrei ${found.length} documento(s) sobre isso:\n\n${lines.join('\n')}`, sources }
  } catch (e) {
    console.error('[askDocumentsAction] Error:', e)
    return { response: '', sources: [], error: 'Erro ao consultar os documentos.' }
  }
}

/** Mesmo fornecedor do Consultor IA (ai/actions.ts): Gemini, senão OpenAI; null sem chave ou em erro. */
async function askLlm(system: string, user: string): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${system}

Pergunta: "${user}"` }] }] }),
      })
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return text
    } catch (err) {
      console.error('[askDocumentsAction] Gemini error:', err)
    }
  }
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      })
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content
      if (text) return text
    } catch (err) {
      console.error('[askDocumentsAction] OpenAI error:', err)
    }
  }
  return null
}
