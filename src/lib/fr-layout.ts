// Estrutura de uma Folha de Registo importada de Word (.doc/.docx) — permite mostrar na app
// uma cópia fiel do original (cabeçalho, título, instruções, tabelas com as mesmas colunas
// e linhas, notas como "MODELO: ..."), página a página, e derivar os campos que o técnico
// preenche na OT. O texto vem de word-extractor: nas tabelas, cada célula termina em \t e
// cada linha da tabela é uma linha de texto.

export type FrTextBlock = { kind: 'title' | 'text' | 'caption' | 'note'; text: string }
export type FrTableBlock = { kind: 'table'; columns: string[]; rows: string[][] }
export type FrBlock = FrTextBlock | FrTableBlock

export interface FrLayout {
  heading: string | null
  code: string | null
  revision: string | null
  pages: FrBlock[][]
}

const CODE_RE = /^(FR|IT|MAN)[\s/._-]*[A-Z]*[\s/._-]*\d+/i
const CAPTION_MAX_CHARS = 40
const DATE_COLUMN_RE = /^(dia|data|date)$/i

type Token = { type: 'line'; text: string } | { type: 'table'; columns: string[]; rows: string[][] }

function cleanLines(raw: string): string[] {
  return raw.replace(/\r\n?/g, '\n').split('\n')
}

function splitCells(line: string): string[] {
  const cells = line.split('\t').map((c) => c.trim())
  // A marca de fim de linha da tabela vira um \t final — célula vazia a mais.
  if (cells.length > 1 && cells[cells.length - 1] === '') cells.pop()
  return cells
}

function tokenize(body: string): Token[] {
  const tokens: Token[] = []
  let tableLines: string[] = []
  const flushTable = () => {
    if (tableLines.length === 0) return
    const [head, ...rest] = tableLines.map(splitCells)
    const width = Math.max(head.length, ...rest.map((r) => r.length))
    const pad = (r: string[]) => [...r, ...Array(Math.max(0, width - r.length)).fill('')]
    tokens.push({ type: 'table', columns: pad(head), rows: rest.map(pad) })
    tableLines = []
  }
  for (const line of cleanLines(body)) {
    if (line.includes('\t')) {
      tableLines.push(line)
      continue
    }
    flushTable()
    const text = line.trim()
    if (text) tokens.push({ type: 'line', text })
  }
  flushTable()
  return tokens
}

function parseHeader(headers: string): { heading: string | null; code: string | null } {
  const parts = headers.split(/[\t\n]/).map((p) => p.trim()).filter(Boolean)
  const code = parts.find((p) => CODE_RE.test(p)) || null
  const heading = parts.find((p) => p !== code) || null
  return { heading, code }
}

/** Converte o texto extraído de um Word (corpo, cabeçalhos, rodapés) na estrutura da FR. */
export function parseFrText(body: string, headers = '', footers = ''): FrLayout {
  const { heading, code } = parseHeader(headers)
  const revision = cleanLines(footers).map((l) => l.trim()).find(Boolean) || null
  const tokens = tokenize(body)
  const title = tokens.find((t): t is Extract<Token, { type: 'line' }> => t.type === 'line')?.text ?? null

  const pages: FrBlock[][] = []
  let page: FrBlock[] = []
  tokens.forEach((t, i) => {
    if (t.type === 'table') {
      page.push({ kind: 'table', columns: t.columns, rows: t.rows })
      return
    }
    if (title && t.text === title) {
      if (page.length > 0) pages.push(page)
      page = [{ kind: 'title', text: t.text }]
      return
    }
    const next = tokens[i + 1]
    const prev = tokens[i - 1]
    // Legenda = rótulo curto colado à tabela ("UPS ED20 - 1"); uma frase (acaba em ponto) é texto.
    if (next?.type === 'table' && t.text.length <= CAPTION_MAX_CHARS && !/[.:;!?]$/.test(t.text)) page.push({ kind: 'caption', text: t.text })
    else if (prev?.type === 'table') page.push({ kind: 'note', text: t.text })
    else page.push({ kind: 'text', text: t.text })
  })
  if (page.length > 0) pages.push(page)

  return { heading, code, revision, pages }
}

/** Campos que o técnico preenche: uma coluna de cada tabela (exceto a da data). */
export function fieldLabelsFromLayout(layout: FrLayout): string[] {
  const labels: string[] = []
  for (const page of layout.pages) {
    let caption: string | null = null
    for (const block of page) {
      if (block.kind === 'caption') caption = block.text
      if (block.kind !== 'table') continue
      block.columns.forEach((col, idx) => {
        if (!col || (idx === 0 && DATE_COLUMN_RE.test(col))) return
        labels.push(caption ? `${caption} — ${col}` : col)
      })
      caption = null
    }
  }
  return Array.from(new Set(labels))
}

/** Título de documento: 1ª linha de título da FR. */
export function titleFromLayout(layout: FrLayout): string | null {
  for (const page of layout.pages) {
    const t = page.find((b) => b.kind === 'title')
    if (t && t.kind === 'title') return t.text
  }
  return null
}

/**
 * Folha de Excel (linhas de células) → o mesmo formato de texto que o Word dá a parseFrText:
 * linhas com 2+ células preenchidas são linhas de tabela (células separadas por \t), linhas
 * com uma só célula são texto. Linhas vazias no meio de uma tabela mantêm-se (linhas a
 * preencher), as vazias fora de tabelas são ignoradas.
 */
export function rowsToText(rows: unknown[][]): string {
  const cellText = (v: unknown) => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim()
  const width = Math.max(0, ...rows.map((r) => r.length))
  let inTable = false
  const lines: string[] = []
  for (const row of rows) {
    const cells = row.map(cellText)
    const filled = cells.filter(Boolean)
    if (filled.length >= 2 || (inTable && filled.length === 0)) {
      inTable = true
      lines.push(Array.from({ length: width }, (_, i) => cells[i] || '').join('\t') + '\t')
    } else {
      inTable = false
      if (filled.length === 1) lines.push(filled[0])
    }
  }
  // Linhas vazias no fim de uma tabela no Excel são só células formatadas a mais.
  return lines.join('\n')
}

/** Texto corrido da estrutura (procedimento de uma IT), tabelas com colunas separadas por " | ". */
export function layoutToPlainText(layout: FrLayout): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const page of layout.pages) {
    for (const block of page) {
      const text = block.kind === 'table'
        ? [block.columns, ...block.rows].map((r) => r.filter(Boolean).join(' | ')).filter(Boolean).join('\n')
        : block.text
      // Cabeçalhos repetidos em cada página (título, instruções) só uma vez.
      if (!text || (block.kind !== 'table' && seen.has(text))) continue
      seen.add(text)
      out.push(text)
    }
  }
  return out.join('\n')
}

/** Lê o campo `layoutJson` gravado no documento; null se vazio ou inválido. */
export function readFrLayout(raw: string | null | undefined): FrLayout | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as FrLayout
    return Array.isArray(parsed?.pages) ? parsed : null
  } catch {
    return null
  }
}
