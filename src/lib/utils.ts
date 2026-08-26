import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined, lang: string = 'pt'): string {
  if (!date) return '—'
  const iso = toNormalizedIsoDate(date)
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (lang === 'pt') {
    return `${d}-${m}-${y}`
  }
  return `${y}-${m}-${d}`
}

export function formatDateTime(date: string | Date | null | undefined, lang: string = 'pt'): string {
  if (!date) return '—'
  const dObj = typeof date === 'string' && date.length === 10 ? new Date(`${date}T00:00:00`) : new Date(date)
  if (isNaN(dObj.getTime())) return '—'
  const isoDate = formatDate(dObj, lang)
  const hh = String(dObj.getHours()).padStart(2, '0')
  const mm = String(dObj.getMinutes()).padStart(2, '0')
  return `${isoDate} ${hh}:${mm}`
}

/**
 * Normaliza qualquer formato de data (DD/MM/YYYY, ISO YYYY-MM-DD, Date, etc.)
 * para o formato padrão ISO "YYYY-MM-DD", garantindo ordenação cronológica perfeita.
 */
export function toNormalizedIsoDate(val: any): string {
  if (!val) return ''
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return ''
    const year = val.getFullYear()
    const month = String(val.getMonth() + 1).padStart(2, '0')
    const day = String(val.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const str = String(val).trim()
  if (!str || str === '—' || str === 'N/D') return ''

  // 1. Formato YYYY-MM-DD (ISO)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (isoMatch) {
    const y = isoMatch[1]
    const m = isoMatch[2].padStart(2, '0')
    const d = isoMatch[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // 2. Formato DD/MM/YYYY ou DD-MM-YYYY (Português)
  const ptMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (ptMatch) {
    const d = ptMatch[1].padStart(2, '0')
    const m = ptMatch[2].padStart(2, '0')
    const y = ptMatch[3]
    return `${y}-${m}-${d}`
  }

  // 3. Fallback de tentativa com Date.parse
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return str
}

/**
 * Função de comparação de datas à prova de falhas para ordenação (Array.sort / useTableSort).
 */
export function compareDates(a: any, b: any, desc = false): number {
  const dateA = toNormalizedIsoDate(a)
  const dateB = toNormalizedIsoDate(b)
  if (!dateA && !dateB) return 0
  if (!dateA) return 1
  if (!dateB) return -1
  return desc ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB)
}

export function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '—'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h === 0) return `${m}min`
  return `${h}h ${m}min`
}

/**
 * Estado de atraso de uma tarefa por prazo (dueDate) vs hoje.
 * - verde:    dentro do planeado (ainda não venceu) ou sem prazo
 * - laranja:  vencida há até 1 semana (≤ 7 dias)
 * - vermelho: vencida há mais de 1 semana (> 7 dias)
 * Tarefas concluídas/canceladas não são avaliadas (devolve 'none').
 */
export type DelayLevel = 'verde' | 'laranja' | 'vermelho' | 'none'

export function taskDelayLevel(
  dueDate: string | null | undefined,
  status?: string | null,
): DelayLevel {
  if (status === 'done' || status === 'cancelled') return 'none'
  if (!dueDate) return 'verde'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prazo = new Date(dueDate)
  prazo.setHours(0, 0, 0, 0)
  const diasAtraso = Math.floor((hoje.getTime() - prazo.getTime()) / 86400000)
  if (diasAtraso <= 0) return 'verde'
  if (diasAtraso <= 7) return 'laranja'
  return 'vermelho'
}

export const DELAY_CLASSES: Record<DelayLevel, string> = {
  verde: 'text-green-700 bg-green-50 border border-green-200',
  laranja: 'text-orange-700 bg-orange-50 border border-orange-200',
  vermelho: 'text-red-700 bg-red-50 border border-red-200',
  none: 'text-gray-500',
}

export const DELAY_LABELS: Record<DelayLevel, string> = {
  verde: 'No prazo',
  laranja: 'Em atraso (≤1 semana)',
  vermelho: 'Atraso crítico (>1 semana)',
  none: '',
}

/**
 * Converte atribuições de técnicos em iniciais legíveis (ex: MS, LM, CB, ou LM+MS para múltiplos)
 */
export function resolveTechInitials(
  assignedTo?: string | null,
  assignedToIds?: string[] | null,
  assignedToText?: string | null,
  users: Array<{ id: string; name: string; abbreviation?: string | null }> = []
): string {
  const userMap = new Map<string, string>()
  users.forEach((u) => {
    const abbr = (u.abbreviation || u.name.split(' ').map((n) => n[0]).join('')).toUpperCase()
    userMap.set(u.id.toLowerCase(), abbr)
    userMap.set(u.name.toLowerCase(), abbr)
    if (u.abbreviation) userMap.set(u.abbreviation.toLowerCase(), u.abbreviation.toUpperCase())
  })

  const getAbbr = (raw: string): string => {
    if (!raw) return ''
    const clean = raw.trim()
    if (!clean || clean === '—' || clean === 'N/D') return ''
    const lower = clean.toLowerCase()
    if (userMap.has(lower)) return userMap.get(lower)!

    const found = users.find((u) => u.name.toLowerCase().includes(lower) || u.id.toLowerCase() === lower)
    if (found) {
      return (found.abbreviation || found.name.split(' ').map((n) => n[0]).join('')).toUpperCase()
    }

    if (/^[A-Z]{2,4}$/i.test(clean)) return clean.toUpperCase()
    return clean
  }

  if (assignedToIds && Array.isArray(assignedToIds) && assignedToIds.length > 0) {
    const list = assignedToIds.map(getAbbr).filter(Boolean)
    if (list.length > 0) return Array.from(new Set(list)).join('+')
  }

  const textRaw = assignedToText || assignedTo || ''
  if (textRaw.includes('+') || textRaw.includes(',')) {
    const parts = textRaw.split(/[\+,]/).map((p) => p.trim()).filter(Boolean)
    const list = parts.map(getAbbr).filter(Boolean)
    if (list.length > 0) return Array.from(new Set(list)).join('+')
  }

  if (assignedTo) {
    const abbr = getAbbr(assignedTo)
    if (abbr) return abbr
  }

  if (assignedToText) {
    const abbr = getAbbr(assignedToText)
    if (abbr) return abbr
  }

  return '—'
}
