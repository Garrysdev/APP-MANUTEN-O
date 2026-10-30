// Histórico de OT das folhas FR-MAN-09 (folha "UR"; "INTERVENÇÕES" em 2017/2018).
// As colunas mudaram ao longo dos anos, por isso lêem-se pelo título, não pela posição.
// Mesmo formato da importação de 14/09/2026: OT concluídas, source 'historico_excel',
// técnicos só em texto, sem assetId (só área/TAG), origem em observacoes.
import type { TipoTarefa } from '@/types/models'

export type SheetRows = unknown[][]

export interface HistoryRow {
  line: number
  excelId: string | null
  date: string // AAAA-MM-DD
  area: string | null
  tag: string | null
  ti: string | null
  title: string
  action: string | null
  techs: string | null
  start: string | null
  end: string | null
}

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const str = (v: unknown) => { const s = String(v ?? '').trim(); return s ? s : null }
const pad = (n: number) => String(n).padStart(2, '0')

/** Data de uma célula (Date, número de série do Excel ou "dd/mm/aaaa") → AAAA-MM-DD. */
export function cellDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  const m = String(v ?? '').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  return m ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : null
}

const TIPOS: Record<string, TipoTarefa> = { PI: 'pi', MC: 'curativa', MI: 'mi', PM: 'plano', MP: 'mp', STP: 'stp', PR: 'projeto' }
export function tipoFromTi(ti: string | null): TipoTarefa {
  return TIPOS[norm(ti)] ?? 'outro'
}

export function parseHistorySheet(rows: SheetRows): HistoryRow[] {
  const h = rows.slice(0, 10).findIndex((r) => { const u = (r || []).map(norm); return u.includes('DATA') && (u.includes('TI') || u.includes('ACCAO')) })
  if (h < 0) return []
  const head = (rows[h] || []).map(norm)
  const col = (...names: string[]) => head.findIndex((x) => names.includes(x))
  const c = {
    id: col('ID'), date: col('DATA'), area: col('AREA'), tag: col('EQUI. / TAG', 'EQUI./TAG', 'TAG', 'EQUIPAMENTO'),
    ti: col('TI'), avaria: col('AVARIA'), techs: col('TECNICOS', 'TECNICO'), start: col('INICIO'), end: col('FIM'), action: col('ACCAO', 'ACAO'),
  }
  const at = (r: unknown[], i: number) => (i >= 0 ? r[i] : null)
  const out: HistoryRow[] = []
  rows.slice(h + 1).forEach((r, k) => {
    if (!r) return
    const date = cellDate(at(r, c.date))
    const action = str(at(r, c.action))
    // 2017 não tem AVARIA: a ACÇÃO faz de título.
    const title = str(at(r, c.avaria)) ?? action
    if (!date || !title) return
    out.push({
      line: h + 2 + k,
      excelId: str(at(r, c.id)),
      date,
      area: str(at(r, c.area)),
      tag: str(at(r, c.tag)),
      ti: str(at(r, c.ti))?.toUpperCase() ?? null,
      title: title.slice(0, 300),
      action: c.avaria >= 0 ? action : null,
      techs: str(at(r, c.techs)),
      start: cellDate(at(r, c.start)),
      end: cellDate(at(r, c.end)),
    })
  })
  return out
}

/** Chave para não importar duas vezes a mesma OT (data + área + TAG + título). */
export function historyKey(t: { date?: string | null; area?: string | null; tag?: string | null; title?: string | null }): string {
  const n = (s?: string | null) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  return [String(t.date ?? '').slice(0, 10), n(t.area), n(t.tag), n(t.title)].join('|')
}
