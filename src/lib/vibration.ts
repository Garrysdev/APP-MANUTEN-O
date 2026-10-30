/**
 * Manutenção Preditiva — leitura e análise de exportações de vibração (.csv).
 *
 * Formato suportado (exportação do SCADA/historiador): colunas aos pares
 * "<série> Time";"<série> ValueY", separadas por ';' (ou ','), datas US com AM/PM
 * ("7/1/2026 4:06:27 PM") ou D/M/AAAA 24h. As leituras (~10 s) são agregadas em
 * intervalos de 10 min (mín/média/máx) — 144 por dia — para não guardar milhões de
 * pontos no Firestore.
 */

export const BUCKET_MINUTES = 10
export const BUCKETS_PER_DAY = (24 * 60) / BUCKET_MINUTES

export interface VibSeriesMeta {
  key: string
  sensor: string
  metric: string
  label: string
  unit: string
}

export interface VibSeriesDay {
  min: (number | null)[]
  avg: (number | null)[]
  max: (number | null)[]
}

export interface VibDayPayload {
  date: string // AAAA-MM-DD (hora local)
  series: Record<string, VibSeriesDay>
}

export interface VibLimits {
  /** Velocidade RMS (mm/s): fronteiras das zonas ISO 10816-3 A/B, B/C, C/D. */
  ab: number
  bc: number
  cd: number
  /** Temperatura de alarme (°C). */
  temp: number
  /** Corrente de alarme do motor (A); 0/ausente = sem alarme. */
  current?: number
}

// ISO 10816-3 / 20816-3, Grupo 2 (15–300 kW) — o motor de 90 kW encaixa aqui.
export const ISO_PRESETS: Record<'rigid' | 'flexible', VibLimits> = {
  rigid: { ab: 1.4, bc: 2.8, cd: 4.5, temp: 80 },
  flexible: { ab: 2.3, bc: 4.5, cd: 7.1, temp: 80 },
}

const METRIC_UNITS: Record<string, string> = {
  vRMS: 'mm/s',
  aRMS: 'm/s²',
  aPeak: 'm/s²',
  Crista: '',
  Temperatura: '°C',
}

const METRIC_LABELS: Record<string, string> = {
  // Nomes usados no Sistema de Monitorização de Vibrações (SCADA).
  vRMS: 'Fadiga',
  aRMS: 'Fricção',
  aPeak: 'Choque',
  Crista: 'Fator de crista',
  Temperatura: 'Temperatura',
}

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric
}

/** Chave segura para campo do Firestore (sem pontos nem espaços). */
function safeKey(s: string): string {
  return s.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80)
}

/** "Trend_SGM_SGM_R3_VIB1_vRMS_Valor ValueY" → sensor VIB1, métrica vRMS. */
export function parseSeriesName(raw: string): VibSeriesMeta {
  const name = raw.replace(/"/g, '').replace(/\s+(Time|ValueY)$/i, '').replace(/^Trend_/, '').trim()
  const vib = name.match(/(VIB\d+)_([A-Za-z]+)(?:_Valor)?$/i)
  if (vib) {
    const sensor = vib[1].toUpperCase()
    const metric = vib[2]
    return { key: `${sensor}__${metric}`, sensor, metric, label: `${sensor} · ${metricLabel(metric)}`, unit: METRIC_UNITS[metric] ?? '' }
  }
  // Outras grandezas (ex.: correntes "…_B_Agua.I_Corrente_L1") — o fim do nome chega.
  const short = name.split(/[_.]/).slice(-4).join(' ').trim() || name
  const kind = PROCESS_KINDS.find((k) => k.re.test(name))
  return { key: safeKey(name), sensor: 'OUTROS', metric: kind?.metric ?? short, label: short, unit: kind?.unit ?? '' }
}

// Grandezas de processo do motor, para relacionar com a vibração.
const PROCESS_KINDS = [
  { re: /corrente|current|(^|[_.])I_?L?\d?([_.]|$)/i, metric: 'Corrente', unit: 'A' },
  { re: /rpm|rota[cç]|veloc|speed/i, metric: 'Velocidade', unit: 'rpm' },
  { re: /freq|hz/i, metric: 'Frequência', unit: 'Hz' },
  { re: /pot[eê]ncia|power|kw/i, metric: 'Potência', unit: 'kW' },
]

/** "SGM_SGM_R3_VIB1_vRMS_Valor" → "R3": o identificador do equipamento junto aos sensores. */
function equipmentToken(rawVibName: string): string | null {
  const m = rawVibName.replace(/"/g, '').match(/([A-Za-z0-9]+)_VIB\d+_/i)
  return m ? m[1] : null
}

/**
 * Uma grandeza de processo (corrente, rpm…) só entra se for do mesmo equipamento dos
 * sensores de vibração (ex.: tem "R3" ou "Agitador" no nome) — as correntes de outras
 * máquinas exportadas no mesmo ficheiro (bombas de Água/Descarga/Termofluido) ficam de fora.
 */
export function belongsToEquipment(rawName: string, tokens: string[]): boolean {
  const name = rawName.replace(/"/g, '')
  if (/agitador/i.test(name)) return true
  return tokens.some((t) => new RegExp(`(^|[^A-Za-z0-9])${t}([^A-Za-z0-9]|$)`, 'i').test(name))
}

/** Devolve o instante (ms, hora local) ou null se o texto não for uma data reconhecida. */
export function parseTimestamp(s: string): number | null {
  const t = s.trim().replace(/"/g, '')
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (m) {
    let h = +m[4] % 12
    if (m[7].toUpperCase() === 'PM') h += 12
    return new Date(+m[3], +m[1] - 1, +m[2], h, +m[5], +(m[6] ?? 0)).getTime()
  }
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] ?? 0)).getTime()
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime()
  return null
}

export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function bucketOf(ts: number): number {
  const d = new Date(ts)
  return Math.floor((d.getHours() * 60 + d.getMinutes()) / BUCKET_MINUTES)
}

interface Acc { min: Float64Array; max: Float64Array; sum: Float64Array; n: Uint32Array }

function newAcc(): Acc {
  return {
    min: new Float64Array(BUCKETS_PER_DAY).fill(Infinity),
    max: new Float64Array(BUCKETS_PER_DAY).fill(-Infinity),
    sum: new Float64Array(BUCKETS_PER_DAY),
    n: new Uint32Array(BUCKETS_PER_DAY),
  }
}

const round = (v: number) => Math.round(v * 10000) / 10000
const G = 9.80665

/**
 * Agregador por linhas: `push(linha)` para cada linha do ficheiro (a 1ª é o cabeçalho),
 * `finish()` no fim. Não guarda as linhas — um ficheiro de 85 MB cabe na memória do browser.
 */
export function createVibrationAggregator() {
  let sep = ';'
  let metas: VibSeriesMeta[] | null = null
  let use: boolean[] = []
  const days = new Map<string, Map<string, Acc>>()
  const peak = new Map<string, number>()
  let rows = 0
  let firstTs = Infinity
  let lastTs = -Infinity

  function push(line: string) {
    const clean = line.replace(/^﻿/, '').replace(/\r$/, '')
    if (!clean.trim()) return
    if (!metas) {
      sep = clean.split(';').length >= clean.split(',').length ? ';' : ','
      const cols = clean.split(sep)
      metas = []
      const raws: string[] = []
      for (let i = 1; i < cols.length; i += 2) { raws.push(cols[i]); metas.push(parseSeriesName(cols[i])) }
      // Vibrações sempre; corrente/rpm/… só se forem do mesmo equipamento (ver belongsToEquipment).
      const tokens = [...new Set(raws.map(equipmentToken).filter((t): t is string => !!t))]
      use = metas.map((m, i) => m.sensor !== 'OUTROS' || belongsToEquipment(raws[i], tokens))
      return
    }
    rows++
    const c = clean.split(sep)
    for (let k = 0; k < metas.length; k++) {
      if (!use[k]) continue
      const tRaw = c[2 * k]
      const vRaw = c[2 * k + 1]
      if (!tRaw || vRaw === undefined || vRaw === '') continue
      const ts = parseTimestamp(tRaw)
      if (ts === null) continue
      const v = parseFloat(vRaw.replace(',', '.').replace(/"/g, ''))
      if (!Number.isFinite(v)) continue
      if (ts < firstTs) firstTs = ts
      if (ts > lastTs) lastTs = ts
      const dk = dayKey(ts)
      let day = days.get(dk)
      if (!day) { day = new Map(); days.set(dk, day) }
      const key = metas[k].key
      let acc = day.get(key)
      if (!acc) { acc = newAcc(); day.set(key, acc) }
      const b = bucketOf(ts)
      if (v < acc.min[b]) acc.min[b] = v
      if (v > acc.max[b]) acc.max[b] = v
      acc.sum[b] += v
      acc.n[b]++
      const p = peak.get(key) ?? 0
      if (Math.abs(v) > p) peak.set(key, Math.abs(v))
    }
  }

  function finish(): { series: VibSeriesMeta[]; days: VibDayPayload[]; rows: number; from: number | null; to: number | null } {
    const all = metas ?? []
    // vRMS exportado em m/s (valores < 0,1) → mm/s, a unidade das zonas ISO.
    const scale = new Map<string, number>()
    // Aceleração exportada em g (o SCADA mostra m/s²) → m/s².
    for (const m of all) {
      if (m.metric === 'vRMS' && (peak.get(m.key) ?? 0) < 0.1) scale.set(m.key, 1000)
      if ((m.metric === 'aRMS' || m.metric === 'aPeak') && (peak.get(m.key) ?? 0) < 5) scale.set(m.key, G)
    }
    const series = all.filter((_, i) => use[i])
    const keep = new Set(series.map((m) => m.key))
    const out: VibDayPayload[] = []
    for (const date of [...days.keys()].sort()) {
      const day = days.get(date)!
      const s: Record<string, VibSeriesDay> = {}
      for (const [key, acc] of day) {
        if (!keep.has(key)) continue
        const f = scale.get(key) ?? 1
        const min: (number | null)[] = []
        const avg: (number | null)[] = []
        const max: (number | null)[] = []
        for (let b = 0; b < BUCKETS_PER_DAY; b++) {
          const has = acc.n[b] > 0
          min.push(has ? round(acc.min[b] * f) : null)
          avg.push(has ? round((acc.sum[b] / acc.n[b]) * f) : null)
          max.push(has ? round(acc.max[b] * f) : null)
        }
        s[key] = { min, avg, max }
      }
      if (Object.keys(s).length) out.push({ date, series: s })
    }
    return {
      series,
      days: out,
      rows,
      from: Number.isFinite(firstTs) ? firstTs : null,
      to: Number.isFinite(lastTs) ? lastTs : null,
    }
  }

  return { push, finish }
}

/** Junta dois dias por intervalo: o valor novo ganha onde existe, senão fica o antigo. */
export function mergeSeriesDay(oldDay: VibSeriesDay | undefined, incoming: VibSeriesDay): VibSeriesDay {
  if (!oldDay) return incoming
  const pick = (a: (number | null)[], b: (number | null)[]) =>
    Array.from({ length: BUCKETS_PER_DAY }, (_, i) => (b[i] ?? null) !== null ? b[i] : (a[i] ?? null))
  return { min: pick(oldDay.min, incoming.min), avg: pick(oldDay.avg, incoming.avg), max: pick(oldDay.max, incoming.max) }
}

export type Zone = 'A' | 'B' | 'C' | 'D'

export function zoneOf(v: number, l: VibLimits): Zone {
  if (v < l.ab) return 'A'
  if (v < l.bc) return 'B'
  if (v < l.cd) return 'C'
  return 'D'
}

/** Regressão linear simples (mínimos quadrados). */
export function linearTrend(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  if (points.length < 3) return null
  const n = points.length
  const sx = points.reduce((a, p) => a + p.x, 0)
  const sy = points.reduce((a, p) => a + p.y, 0)
  const sxx = points.reduce((a, p) => a + p.x * p.x, 0)
  const sxy = points.reduce((a, p) => a + p.x * p.y, 0)
  const den = n * sxx - sx * sx
  if (den === 0) return null
  const slope = (n * sxy - sx * sy) / den
  return { slope, intercept: (sy - slope * sx) / n }
}

/** Dias até a tendência atingir `limit` a partir de `xNow`; null se estável/descendente. */
export function daysToLimit(trend: { slope: number; intercept: number } | null, xNow: number, limit: number): number | null {
  if (!trend || trend.slope <= 0) return null
  const x = (limit - trend.intercept) / trend.slope
  const d = x - xNow
  return d > 0 ? d : 0
}
