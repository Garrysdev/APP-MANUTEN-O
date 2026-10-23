// Transformações dos dias de vibração para os gráficos e análises da página Preditiva.
import { BUCKET_MINUTES, BUCKETS_PER_DAY, linearTrend, daysToLimit, zoneOf, type VibDayPayload, type VibLimits, type Zone } from './vibration'

export interface ChartPoint { t: number; [key: string]: number | null }

function dayStart(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Pontos para gráfico: média (e máximo em `<key>_max`) por intervalo, agrupando `group` intervalos de 10 min. */
export function buildPoints(days: VibDayPayload[], keys: string[], group = 1): ChartPoint[] {
  const out: ChartPoint[] = []
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const t0 = dayStart(day.date)
    for (let b = 0; b < BUCKETS_PER_DAY; b += group) {
      const p: ChartPoint = { t: t0 + b * BUCKET_MINUTES * 60_000 }
      let any = false
      for (const key of keys) {
        const s = day.series[key]
        if (!s) { p[key] = null; continue }
        let sum = 0, n = 0, mx = -Infinity
        for (let i = b; i < b + group && i < BUCKETS_PER_DAY; i++) {
          const a = s.avg[i]
          const m = s.max[i]
          if (a !== null && a !== undefined) { sum += a; n++ }
          if (m !== null && m !== undefined && m > mx) mx = m
        }
        p[key] = n ? Math.round((sum / n) * 1000) / 1000 : null
        p[`${key}_max`] = Number.isFinite(mx) ? mx : null
        if (n) any = true
      }
      if (any) out.push(p)
    }
  }
  return out
}

/** Média e máximo diários de uma série. */
export function dailyStats(days: VibDayPayload[], key: string): { date: string; avg: number; max: number }[] {
  const out: { date: string; avg: number; max: number }[] = []
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const s = day.series[key]
    if (!s) continue
    const avgs = s.avg.filter((v): v is number => v !== null)
    const maxs = s.max.filter((v): v is number => v !== null)
    if (!avgs.length) continue
    out.push({ date: day.date, avg: avgs.reduce((a, v) => a + v, 0) / avgs.length, max: Math.max(...maxs) })
  }
  return out
}

function lastValue(days: VibDayPayload[], key: string): { value: number; t: number } | null {
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date))
  for (const day of sorted) {
    const s = day.series[key]
    if (!s) continue
    for (let b = BUCKETS_PER_DAY - 1; b >= 0; b--) {
      const v = s.avg[b]
      if (v !== null && v !== undefined) return { value: v, t: dayStart(day.date) + b * BUCKET_MINUTES * 60_000 }
    }
  }
  return null
}

export interface SensorSummary {
  sensor: string
  velocity: number | null
  zone: Zone | null
  temperature: number | null
  crest: number | null
  friction: number | null // Fricção (aRMS, m/s²)
  shock: number | null // Choque (aPeak, m/s²)
  changePct: number | null // média dos últimos 7 dias vs. 7 anteriores
  daysToAlert: number | null // projeção até à fronteira B/C
  lastAt: number | null
}

export function summarizeSensor(days: VibDayPayload[], sensor: string, limits: VibLimits): SensorSummary {
  const vKey = `${sensor}__vRMS`
  const v = lastValue(days, vKey)
  const temp = lastValue(days, `${sensor}__Temperatura`)
  const crest = lastValue(days, `${sensor}__Crista`)
  const daily = dailyStats(days, vKey)

  let changePct: number | null = null
  if (daily.length >= 4) {
    const half = Math.min(7, Math.floor(daily.length / 2))
    const recent = daily.slice(-half)
    const before = daily.slice(-2 * half, -half)
    const mean = (a: typeof daily) => a.reduce((s, d) => s + d.avg, 0) / a.length
    const b = mean(before)
    if (b > 0) changePct = ((mean(recent) - b) / b) * 100
  }

  const t0 = daily.length ? dayStart(daily[0].date) : 0
  const pts = daily.map((d) => ({ x: (dayStart(d.date) - t0) / 86_400_000, y: d.avg }))
  // Com menos de 5 dias a reta é ruído; projeções além de 1 ano contam como "estável".
  const trend = pts.length >= 5 ? linearTrend(pts) : null
  const xNow = pts.length ? pts[pts.length - 1].x : 0
  const current = trend ? trend.slope * xNow + trend.intercept : null
  const projected = current !== null && current < limits.bc ? daysToLimit(trend, xNow, limits.bc) : null
  const daysToAlert = projected !== null && projected <= 365 ? projected : null

  return {
    sensor,
    velocity: v?.value ?? null,
    zone: v ? zoneOf(v.value, limits) : null,
    temperature: temp?.value ?? null,
    crest: crest?.value ?? null,
    friction: lastValue(days, `${sensor}__aRMS`)?.value ?? null,
    shock: lastValue(days, `${sensor}__aPeak`)?.value ?? null,
    changePct,
    daysToAlert,
    lastAt: v?.t ?? temp?.t ?? null,
  }
}

export interface VibAlert { date: string; sensor: string; kind: 'vibração' | 'temperatura'; value: number; level: 'alerta' | 'perigo' }

/** Um alerta por dia/sensor/tipo — o pior valor máximo do dia. */
export function findAlerts(days: VibDayPayload[], sensors: string[], limits: VibLimits): VibAlert[] {
  const out: VibAlert[] = []
  for (const day of days) {
    for (const sensor of sensors) {
      const v = day.series[`${sensor}__vRMS`]
      if (v) {
        const mx = Math.max(...v.max.filter((x): x is number => x !== null))
        if (mx >= limits.bc) out.push({ date: day.date, sensor, kind: 'vibração', value: mx, level: mx >= limits.cd ? 'perigo' : 'alerta' })
      }
      const t = day.series[`${sensor}__Temperatura`]
      if (t) {
        const mx = Math.max(...t.max.filter((x): x is number => x !== null))
        if (mx >= limits.temp) out.push({ date: day.date, sensor, kind: 'temperatura', value: mx, level: mx >= limits.temp + 10 ? 'perigo' : 'alerta' })
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Datas AAAA-MM-DD dos últimos `n` dias até `end` (inclusive). */
export function lastDates(end: string, n: number): string[] {
  const t = dayStart(end)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(t - (n - 1 - i) * 86_400_000 + 12 * 3_600_000) // meio-dia evita a mudança de hora
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
}
