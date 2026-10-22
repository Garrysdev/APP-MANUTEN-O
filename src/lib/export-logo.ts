import type ExcelJS from 'exceljs'

// Logótipo da empresa (Perfil → Empresa, guardado no Cloudinary) nos ficheiros exportados.
// Pede ao Cloudinary uma versão PNG com altura fixa — formato que o ExcelJS e o jsPDF aceitam,
// mesmo que o original seja SVG/WebP — e lê as dimensões do próprio PNG.

export type ExportLogo = { base64: string; width: number; height: number }

const LOGO_FETCH_HEIGHT = 160
const EXCEL_LOGO_HEIGHT_PX = 40
const EXCEL_TITLE_ROW_HEIGHT_PT = 36

function pngUrl(url: string): string {
  return url.includes('res.cloudinary.com') && url.includes('/upload/')
    // Fundo branco: o título dos Excel é uma faixa azul escura e um logótipo transparente
    // (texto verde/escuro) ficaria ilegível por cima dela.
    ? url.replace('/upload/', `/upload/f_png,b_white,h_${LOGO_FETCH_HEIGHT}/`)
    : url
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** PNG do logótipo em base64 com as dimensões; null sem logótipo ou se o pedido falhar. */
export async function fetchExportLogo(logoUrl: string | null | undefined): Promise<ExportLogo | null> {
  if (!logoUrl) return null
  try {
    const res = await fetch(pngUrl(logoUrl))
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    if (!isPng) return null
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return { base64: toBase64(bytes), width: view.getUint32(16), height: view.getUint32(20) }
  } catch (err) {
    console.warn('[export-logo] Não foi possível obter o logótipo:', err)
    return null
  }
}

/** Põe o logótipo no canto superior esquerdo (linha do título) de todas as folhas. */
export async function addLogoToWorkbook(workbook: ExcelJS.Workbook, logoUrl: string | null | undefined): Promise<void> {
  const logo = await fetchExportLogo(logoUrl)
  if (!logo || !(logo.height > 0)) return
  const imageId = workbook.addImage({ base64: logo.base64, extension: 'png' })
  const width = Math.round((logo.width / logo.height) * EXCEL_LOGO_HEIGHT_PX)
  workbook.eachSheet((sheet) => {
    const row = sheet.getRow(1)
    row.height = Math.max(row.height || 0, EXCEL_TITLE_ROW_HEIGHT_PT)
    sheet.addImage(imageId, { tl: { col: 0.05, row: 0.08 }, ext: { width, height: EXCEL_LOGO_HEIGHT_PX } })
  })
}
