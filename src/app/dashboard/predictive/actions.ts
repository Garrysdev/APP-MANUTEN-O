'use server'

import { getCurrentProfile } from '@/lib/firebase/session'
import { getAsset } from '@/lib/firebase/data'
import { getVibrationDays, saveVibrationDay, updateVibrationSettings } from '@/lib/firebase/vibration-data'
import { planHas } from '@/lib/plans'
import { BUCKETS_PER_DAY, type VibDayPayload, type VibLimits, type VibSeriesMeta } from '@/lib/vibration'
import type { PlanName } from '@/types/models'

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KEY_RE = /^[A-Za-z0-9_]{1,80}$/
const MAX_SERIES = 80
const MAX_DAYS_READ = 92

async function authorize(assetId: string) {
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Sessão expirada.')
  if (profile.role !== 'manager') throw new Error('Só o gestor pode gerir a Manutenção Preditiva.')
  const plan = (profile.company?.plan ?? 'free') as PlanName
  if (!planHas(plan, 'predictive')) throw new Error('Disponível no plano Business.')
  if (typeof assetId !== 'string' || !assetId) throw new Error('Escolhe o equipamento.')
  const asset = await getAsset(profile.companyId, assetId)
  if (!asset) throw new Error('Equipamento não encontrado.')
  return { companyId: profile.companyId, assetId: asset.id }
}

function validNumbers(arr: unknown): arr is (number | null)[] {
  return Array.isArray(arr) && arr.length === BUCKETS_PER_DAY && arr.every((v) => v === null || (typeof v === 'number' && Number.isFinite(v)))
}

function validateDay(day: VibDayPayload): void {
  if (!day || typeof day.date !== 'string' || !DATE_RE.test(day.date)) throw new Error('Data inválida no ficheiro.')
  const entries = Object.entries(day.series ?? {})
  if (entries.length === 0 || entries.length > MAX_SERIES) throw new Error('Número de séries inválido.')
  for (const [key, s] of entries) {
    if (!KEY_RE.test(key) || !validNumbers(s?.min) || !validNumbers(s?.avg) || !validNumbers(s?.max)) {
      throw new Error(`Série inválida: ${key}`)
    }
  }
}

function cleanSeries(series: VibSeriesMeta[]): VibSeriesMeta[] {
  if (!Array.isArray(series) || series.length > MAX_SERIES) throw new Error('Lista de séries inválida.')
  return series.map((m) => {
    if (!KEY_RE.test(m?.key ?? '')) throw new Error('Lista de séries inválida.')
    const str = (v: unknown) => String(v ?? '').slice(0, 120)
    return { key: m.key, sensor: str(m.sensor), metric: str(m.metric), label: str(m.label), unit: str(m.unit).slice(0, 10) }
  })
}

export async function importVibrationDayAction(assetId: string, day: VibDayPayload, series: VibSeriesMeta[]): Promise<Result> {
  try {
    const { companyId, assetId: id } = await authorize(assetId)
    validateDay(day)
    const meta = cleanSeries(series).filter((m) => m.key in day.series)
    await saveVibrationDay(companyId, id, { date: day.date, series: day.series }, meta)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao importar.' }
  }
}

export async function loadVibrationDaysAction(assetId: string, dates: string[]): Promise<Result<VibDayPayload[]>> {
  try {
    const { companyId, assetId: id } = await authorize(assetId)
    if (!Array.isArray(dates) || dates.length > MAX_DAYS_READ || !dates.every((d) => DATE_RE.test(d))) {
      throw new Error(`Período inválido (máximo ${MAX_DAYS_READ} dias).`)
    }
    return { ok: true, data: await getVibrationDays(companyId, id, dates) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao carregar dados.' }
  }
}

export async function saveVibrationSettingsAction(
  assetId: string,
  data: { sensorLabels: Record<string, string>; limits: VibLimits; base: 'rigid' | 'flexible' },
): Promise<Result> {
  try {
    const { companyId, assetId: id } = await authorize(assetId)
    const labels: Record<string, string> = {}
    for (const [k, v] of Object.entries(data?.sensorLabels ?? {}).slice(0, MAX_SERIES)) {
      if (KEY_RE.test(k)) labels[k] = String(v ?? '').trim().slice(0, 60)
    }
    const l = data?.limits
    const nums = [l?.ab, l?.bc, l?.cd, l?.temp]
    if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)) throw new Error('Limites inválidos.')
    if (!(l.ab < l.bc && l.bc < l.cd)) throw new Error('Os limites têm de ser crescentes (A/B < B/C < C/D).')
    const current = typeof l.current === 'number' && Number.isFinite(l.current) && l.current > 0 ? l.current : 0
    const base = data.base === 'flexible' ? 'flexible' : 'rigid'
    await updateVibrationSettings(companyId, id, { sensorLabels: labels, limits: { ab: l.ab, bc: l.bc, cd: l.cd, temp: l.temp, current }, base })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao guardar.' }
  }
}
