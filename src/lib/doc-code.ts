// Referência das FR/IT sempre no formato "FR-MAN-16" / "IT-MAN-02": maiúsculas,
// partes separadas por hífen e número com pelo menos 2 dígitos. Aceita o que vier
// escrito à mão ou do nome do ficheiro ("FR/MAN/7", "fr man 16", "IT.MAN.02").

export function normalizeDocCode(raw: unknown): string {
  const parts = String(raw ?? '').toUpperCase().trim().split(/[\s/\\._–—-]+/).filter(Boolean)
  if (parts.length === 0) return ''
  const last = parts[parts.length - 1].match(/^(\d+)([A-Z]?)$/)
  if (last) parts[parts.length - 1] = last[1].padStart(2, '0') + last[2]
  return parts.join('-')
}

/**
 * Tira do fim do título a data/revisão que vem do nome do ficheiro:
 * "LUBRIFICAÇÃO PASTILHADOR ESTER 25 11 2025" → "LUBRIFICAÇÃO PASTILHADOR ESTER".
 */
export function cleanDocTitle(raw: unknown): string {
  const title = String(raw ?? '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim()
  const cleaned = title
    .replace(/[\s,;:–—-]*\(?\b(?:rev\.?\s*)?\d{1,2}[\s./-]\d{1,2}[\s./-](?:\d{4}|\d{2})\)?$/i, '')
    .replace(/[\s,;:–—-]*\brev\.?\s*\d*$/i, '')
    .trim()
  return cleaned || title
}

/** "FR-MAN-16" / "IT-MAN-02" (o tipo tem de bater com o prefixo). */
export function isValidDocCode(code: string, type: 'FR' | 'IT'): boolean {
  return new RegExp(`^${type}-[A-Z]{2,4}-\\d{2,}[A-Z]?$`).test(code)
}
