import 'server-only'
import WordExtractor from 'word-extractor'
// ExcelJS e não SheetJS (xlsx 0.18): a versão do npm tem poluição de protótipo ao ler
// ficheiros (CVE-2023-30533) e aqui lê-se o que os utilizadores carregam. Sem .xls antigo.
import ExcelJS from 'exceljs'
// O index de pdf-parse 1.x corre um ficheiro de teste quando não há module.parent (Next).
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { parseFrText, rowsToText, fieldLabelsFromLayout, titleFromLayout, layoutToPlainText, type FrLayout } from '@/lib/fr-layout'

// Leitura automática de FR/IT importadas (Gestão Documental), qualquer que seja o formato:
// - Word (.doc/.docx): estrutura completa (cabeçalho, título, instruções, tabelas, notas)
// - Excel (.xls/.xlsx): uma página por folha, linhas de 2+ células como tabela
// - PDF: só o texto (o PDF original já se vê tal e qual no browser)
// - Imagem: nada a ler (o original vê-se tal e qual)

export type DocumentImport = {
  layout: FrLayout | null
  fieldLabels: string[]
  title: string | null
  code: string | null
  content: string | null
}

const EMPTY: DocumentImport = { layout: null, fieldLabels: [], title: null, code: null, content: null }

export function importKind(fileName: string): 'word' | 'excel' | 'pdf' | null {
  if (/\.docx?$/i.test(fileName)) return 'word'
  if (/\.xls[xm]$/i.test(fileName)) return 'excel'
  if (/\.pdf$/i.test(fileName)) return 'pdf'
  return null
}

function fromLayout(layout: FrLayout): DocumentImport {
  if (layout.pages.length === 0) return EMPTY
  return {
    layout,
    fieldLabels: fieldLabelsFromLayout(layout),
    title: titleFromLayout(layout),
    code: layout.code,
    content: layoutToPlainText(layout) || null,
  }
}

async function readWord(bytes: Buffer): Promise<DocumentImport> {
  const doc = await new WordExtractor().extract(bytes)
  return fromLayout(parseFrText(doc.getBody(), doc.getHeaders({ includeFooters: false }), doc.getFooters()))
}

function cellValue(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toLocaleDateString('pt-PT')
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('')
    if ('text' in v) return String(v.text)
    if ('result' in v) return String(v.result ?? '')
    return ''
  }
  return String(v)
}

async function readExcel(bytes: Buffer): Promise<DocumentImport> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(bytes as unknown as ArrayBuffer)
  const pages = wb.worksheets.flatMap((sheet) => {
    const rows: string[][] = []
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, col) => { cells[col - 1] = cellValue(cell.value) })
      rows.push(Array.from(cells, (c) => c ?? ''))
    })
    return parseFrText(rowsToText(rows)).pages
  })
  return fromLayout({ heading: null, code: null, revision: null, pages })
}

async function readPdf(bytes: Buffer): Promise<DocumentImport> {
  const { text } = await pdfParse(bytes)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  return { ...EMPTY, title: lines[0] ?? null, content: lines.join('\n') || null }
}

export async function readDocumentFile(bytes: Buffer, fileName: string): Promise<DocumentImport> {
  switch (importKind(fileName)) {
    case 'word': return readWord(bytes)
    case 'excel': return await readExcel(bytes)
    case 'pdf': return readPdf(bytes)
    default: return EMPTY
  }
}
