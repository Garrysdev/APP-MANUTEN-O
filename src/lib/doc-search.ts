import type { DocumentoObrigatorio } from '@/types/models'

// Procura simples nos documentos da Gestão Documental (FR, IT, Manuais & Normas) para a
// "Pergunta à IA": escolhe os documentos que interessam à pergunta e dá-os de contexto ao
// modelo — ou, sem modelo configurado, mostra-os diretamente com um excerto.

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const STOP = new Set(['como', 'para', 'qual', 'quais', 'onde', 'quando', 'sobre', 'esta', 'este', 'isso', 'faco', 'fazer', 'deve', 'devo', 'com', 'sem', 'que', 'dos', 'das', 'uma', 'por', 'the'])

export function questionTerms(question: string): string[] {
  return [...new Set(norm(question).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)))]
}

function docText(d: DocumentoObrigatorio): string {
  return [d.code, d.title, d.category, d.fileName, d.content, ...(d.fieldLabels || [])].filter(Boolean).join(' \n ')
}

/** Documentos ativos que contêm termos da pergunta, os mais relevantes primeiro. */
export function rankDocuments(docs: DocumentoObrigatorio[], question: string, limit = 12): DocumentoObrigatorio[] {
  const terms = questionTerms(question)
  if (terms.length === 0) return []
  return docs
    .filter((d) => d.active !== false)
    .map((d) => {
      const head = norm(`${d.code} ${d.title}`)
      const body = norm(docText(d))
      const score = terms.reduce((s, t) => s + (head.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0), 0)
      return { d, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.d)
}

/** Até ~200 caracteres do documento à volta do primeiro termo encontrado. */
export function docSnippet(d: DocumentoObrigatorio, question: string): string {
  const text = docText(d).replace(/\s+/g, ' ').trim()
  const lower = norm(text)
  const hit = questionTerms(question).map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (hit === undefined) return text.slice(0, 200)
  const start = Math.max(0, hit - 80)
  return `${start > 0 ? '…' : ''}${text.slice(start, start + 200)}${start + 200 < text.length ? '…' : ''}`
}
