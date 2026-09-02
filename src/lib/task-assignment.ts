import type { Task, User } from '@/types/models'

/**
 * Validação rigorosa e tokenizada de atribuição de tarefas a um técnico/utilizador.
 * Suporta atribuições múltiplas como "MS+CB", "LM+MS", "MS", "Marco Silva",
 * bem como arrays de IDs (assignedToIds) e referências diretas por ID ou Abreviatura.
 */
export function isTaskAssignedToUser(t: any, profile: any): boolean {
  if (!t || !profile) return false

  const pId = String(profile.id || '').toLowerCase().trim()
  const pAbbr = String(profile.abbreviation || '').toLowerCase().trim()
  const pName = String(profile.name || '').toLowerCase().trim()
  const pEmail = String(profile.email || '').toLowerCase().trim()

  // 1. Verificação direta por ID na lista de técnicos atribuídos
  if (t.assignedTo && String(t.assignedTo).toLowerCase().trim() === pId) return true
  if (Array.isArray(t.assignedToIds) && t.assignedToIds.some((id: string) => String(id).toLowerCase().trim() === pId)) return true

  // 2. Análise por tokens do texto de atribuição (ex: "MS+CB", "LM+MS", "MS", "Marco Silva")
  const textToScan = `${t.assignedToText || ''} ${t.assignedTo || ''}`.trim()
  if (textToScan) {
    const tokens = textToScan.split(/[\+,\/&|;\s]+/).map((s) => s.toLowerCase().trim()).filter(Boolean)
    if (pAbbr && tokens.includes(pAbbr)) return true
    if (pId && tokens.includes(pId)) return true
    if (pEmail && tokens.includes(pEmail)) return true
    if (pName && textToScan.toLowerCase().includes(pName)) return true
  }

  // 3. Tarefas criadas explicitamente por este utilizador (nunca 'system')
  if (t.createdBy && t.createdBy !== 'system' && t.createdBy !== 'eu') {
    const c = String(t.createdBy).toLowerCase().trim()
    if (c === pId || (pEmail && c === pEmail)) return true
  }

  return false
}

/**
 * Filtro por técnico para a UI (dropdown multi-seleção e pesquisa de coluna).
 */
export function matchesTechFilter(t: any, tecFilterRaw: string, users: any[]): boolean {
  if (!t || !tecFilterRaw) return true
  const tecFilter = tecFilterRaw.trim().toLowerCase()

  // Encontrar o utilizador correspondente ao filtro (por id, abreviatura ou nome)
  const userObj = users.find(
    (u) =>
      u.id?.toLowerCase() === tecFilter ||
      (u.abbreviation && u.abbreviation.toLowerCase() === tecFilter) ||
      u.name?.toLowerCase() === tecFilter
  )

  if (userObj) {
    return isTaskAssignedToUser(t, userObj)
  }

  // Se não encontrar o objeto utilizador, pesquisa por token/substring direto
  const textToScan = `${t.assignedToText || ''} ${t.assignedTo || ''} ${Array.isArray(t.assignedToIds) ? t.assignedToIds.join(' ') : ''}`.trim().toLowerCase()
  const tokens = textToScan.split(/[\+,\/&|;\s]+/).map((s) => s.toLowerCase().trim()).filter(Boolean)
  return tokens.includes(tecFilter) || textToScan.includes(tecFilter)
}
