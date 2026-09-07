import type { Task, User } from '@/types/models'

/**
 * Validação rigorosa e tokenizada de atribuição de tarefas a um técnico/utilizador.
 * Suporta:
 * 1. Atribuições diretas por ID ou array de IDs (assignedTo, assignedToIds).
 * 2. Tokens de texto em assignedToText e assignedTo (ex: "RG", "LM", "MS+CB", "LM+RG", "Marco Silva").
 * 3. Abreviaturas e nomes normalizados do técnico.
 * 
 * NOTA IMPORTANTE: Apenas verifica a ATRIBUIÇÃO efetiva do técnico à tarefa.
 * NÃO considera createdBy, garantindo que cada técnico só vê as tarefas atribuídas a si.
 */
export function isTaskAssignedToUser(t: any, profile: any): boolean {
  if (!t || !profile) return false

  const pId = String(profile.id || '').toLowerCase().trim()
  const pAbbr = String(profile.abbreviation || '').toLowerCase().trim()
  const pName = String(profile.name || '').toLowerCase().trim()
  const pEmail = String(profile.email || '').toLowerCase().trim()

  // Conjunto de identificadores válidos para este utilizador
  const userTokens = new Set<string>()
  if (pId) userTokens.add(pId)
  if (pEmail) userTokens.add(pEmail)
  if (pAbbr) userTokens.add(pAbbr)

  // Extrair abreviatura ou tokens específicos do nome (ex: "RG - RuiG" -> "rg", "ruig"; "Rui Garrido (RG)" -> "rg")
  if (pName) {
    userTokens.add(pName)
    const parenthesized = pName.match(/\(([a-z0-9_-]+)\)/i)
    if (parenthesized && parenthesized[1]) {
      userTokens.add(parenthesized[1].toLowerCase().trim())
    }
    const prefixAbbr = pName.match(/^([a-z0-9]{2,5})\s*[-–—]/i)
    if (prefixAbbr && prefixAbbr[1]) {
      userTokens.add(prefixAbbr[1].toLowerCase().trim())
    }
    const cleanName = pName.replace(/\(.*?\)/g, '').replace(/^[a-z0-9]{2,5}\s*[-–—]\s*/i, '').trim().toLowerCase()
    if (cleanName && cleanName.length >= 3) {
      userTokens.add(cleanName)
    }
  }

  // 1. Verificação direta por ID em assignedTo
  if (t.assignedTo) {
    const assignedStr = String(t.assignedTo).toLowerCase().trim()
    if (userTokens.has(assignedStr)) return true
    const stripped = assignedStr.replace(/^(tech_|user_)/, '')
    if (userTokens.has(stripped)) return true
  }

  // 2. Verificação direta no array assignedToIds
  if (Array.isArray(t.assignedToIds)) {
    for (const id of t.assignedToIds) {
      const idStr = String(id || '').toLowerCase().trim()
      if (userTokens.has(idStr)) return true
      const stripped = idStr.replace(/^(tech_|user_)/, '')
      if (userTokens.has(stripped)) return true
    }
  }

  // 3. Análise tokenizada por delimitadores (+, ,, /, &, |, ;, espaços) em assignedToText e assignedTo
  const rawText = `${t.assignedToText || ''} ${typeof t.assignedTo === 'string' ? t.assignedTo : ''}`.trim().toLowerCase()
  if (rawText) {
    const tokens = rawText
      .split(/[\+,\/&|;\s\r\n\t]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    for (const tok of tokens) {
      if (userTokens.has(tok)) return true
      const stripped = tok.replace(/^(tech_|user_)/, '')
      if (userTokens.has(stripped)) return true
    }

    if (pName && rawText === pName) return true
    if (pAbbr && tokens.includes(pAbbr)) return true
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

  // Se não encontrar o objeto utilizador, pesquisa por token exato
  const textToScan = `${t.assignedToText || ''} ${t.assignedTo || ''} ${Array.isArray(t.assignedToIds) ? t.assignedToIds.join(' ') : ''}`.trim().toLowerCase()
  const tokens = textToScan.split(/[\+,\/&|;\s]+/).map((s) => s.toLowerCase().trim()).filter(Boolean)
  return tokens.includes(tecFilter) || tokens.some((tok) => tok.replace(/^(tech_|user_)/, '') === tecFilter)
}
