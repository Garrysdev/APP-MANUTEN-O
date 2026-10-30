// Janela de análise da página Preditiva: intervalo escolhido/zoom, estatísticas, tabela e exportação.
import { BUCKET_MINUTES, BUCKETS_PER_DAY, type VibDayPayload, type VibSeriesMeta } from './vibration'

const BUCKET_MS = BUCKET_MINUTES * 60_000

export interface TimeWindow { from: number; to: number } // ms, inclusivo

export function dayStartMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** AAAA-MM-DD (hora local) de um instante. */
export function ymd(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Todas as datas de `from` a `to` (AAAA-MM-DD, inclusive). */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  if (from > to) return out
  let t = dayStartMs(from) + 12 * 3_600_000 // meio-dia evita a mudança de hora
  const end = dayStartMs(to) + 12 * 3_600_000
  while (t <= end) { out.push(ymd(t)); t += 86_400_000 }
  return out
}

/** Quantos intervalos de 10 min juntar para o gráfico ter ~`target` pontos. */
export function autoGroup(spanMs: number, target = 720): number {
  return Math.max(1, Math.ceil(spanMs / BUCKET_MS / target))
}

export interface WindowRow { t: number; key: string; min: number | null; avg: number | null; max: number | null }

/** Linhas (instante × série) dentro da janela, juntando `group` intervalos de 10 min. */
export function windowRows(days: VibDayPayload[], keys: string[], win: TimeWindow, group = 1): WindowRow[] {
  const out: WindowRow[] = []
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const t0 = dayStartMs(day.date)
    if (t0 + 86_400_000 <= win.from || t0 > win.to) continue
    for (let b = 0; b < BUCKETS_PER_DAY; b += group) {
      const t = t0 + b * BUCKET_MS
      if (t < win.from || t > win.to) continue
      for (const key of keys) {
        const s = day.series[key]
        if (!s) continue
        let mn = Infinity, mx = -Infinity, sum = 0, n = 0
        for (let i = b; i < b + group && i < BUCKETS_PER_DAY; i++) {
          const a = s.avg[i], lo = s.min[i], hi = s.max[i]
          if (a !== null && a !== undefined) { sum += a; n++ }
          if (lo !== null && lo !== undefined && lo < mn) mn = lo
          if (hi !== null && hi !== undefined && hi > mx) mx = hi
        }
        if (!n) continue
        out.push({ t, key, min: Number.isFinite(mn) ? mn : null, avg: Math.round((sum / n) * 10000) / 10000, max: Number.isFinite(mx) ? mx : null })
      }
    }
  }
  return out
}

export interface SeriesStats { key: string; n: number; min: number; avg: number; max: number; sd: number; first: number; last: number }

/** Mínimo, média, máximo, desvio-padrão e variação (1.º → último valor médio) de cada série na janela. */
export function windowStats(days: VibDayPayload[], keys: string[], win: TimeWindow): SeriesStats[] {
  const rows = windowRows(days, keys, win)
  return keys.flatMap((key) => {
    const r = rows.filter((x) => x.key === key && x.avg !== null)
    if (!r.length) return []
    const avgs = r.map((x) => x.avg as number)
    const mean = avgs.reduce((a, v) => a + v, 0) / avgs.length
    const sd = Math.sqrt(avgs.reduce((a, v) => a + (v - mean) ** 2, 0) / avgs.length)
    const mins = r.map((x) => x.min ?? (x.avg as number))
    const maxs = r.map((x) => x.max ?? (x.avg as number))
    return [{ key, n: r.length, min: Math.min(...mins), avg: mean, max: Math.max(...maxs), sd, first: avgs[0], last: avgs[avgs.length - 1] }]
  })
}

const num = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))
const stamp = (t: number) => {
  const d = new Date(t)
  return `${ymd(t)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const cell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** CSV (separador ';', vírgula decimal — abre direto no Excel PT): uma linha por intervalo, mín/média/máx por série. */
export function windowCsv(days: VibDayPayload[], metas: VibSeriesMeta[], win: TimeWindow, group = 1): string {
  const keys = metas.map((m) => m.key)
  const rows = windowRows(days, keys, win, group)
  const byT = new Map<number, Map<string, WindowRow>>()
  for (const r of rows) {
    if (!byT.has(r.t)) byT.set(r.t, new Map())
    byT.get(r.t)!.set(r.key, r)
  }
  const head = ['Data/hora', ...metas.flatMap((m) => {
    const u = m.unit ? ` (${m.unit})` : ''
    return [`${m.label} mín${u}`, `${m.label} média${u}`, `${m.label} máx${u}`]
  })]
  const lines = [head.map(cell).join(';')]
  for (const t of [...byT.keys()].sort((a, b) => a - b)) {
    const m = byT.get(t)!
    lines.push([stamp(t), ...keys.flatMap((k) => { const r = m.get(k); return [num(r?.min ?? null), num(r?.avg ?? null), num(r?.max ?? null)] })].join(';'))
  }
  return '﻿' + lines.join('\r\n')
}

/** CSV das linhas da tabela (formato longo). */
export function rowsCsv(rows: WindowRow[], metaOf: (key: string) => VibSeriesMeta | undefined): string {
  const lines = ['Data/hora;Sensor;Grandeza;Unidade;Mínimo;Média;Máximo']
  for (const r of rows) {
    const m = metaOf(r.key)
    lines.push([stamp(r.t), cell(m?.sensor ?? ''), cell(m?.metric ?? r.key), cell(m?.unit ?? ''), num(r.min), num(r.avg), num(r.max)].join(';'))
  }
  return '﻿' + lines.join('\r\n')
}

export { stamp as formatStamp }
