// Manutenção Preditiva — dados de vibração por equipamento.
//
// vibration_days/<companyId>_<assetId>_<AAAA-MM-DD>: 1 documento por equipamento por dia,
//   com as séries agregadas em 144 intervalos de 10 min (ver src/lib/vibration.ts).
//   Lê-se por id (getAll) — 30 dias = 30 leituras, sem índices compostos.
// vibration_config/<companyId>_<assetId>: nomes dos sensores, limites e séries conhecidas.
import 'server-only'
import { adminDbFor } from './tenant-db'
import { mergeSeriesDay, ISO_PRESETS, type VibDayPayload, type VibLimits, type VibSeriesMeta } from '../vibration'

export interface VibrationConfig {
  id: string
  companyId: string
  assetId: string
  sensorLabels: Record<string, string>
  limits: VibLimits
  base: 'rigid' | 'flexible'
  series: VibSeriesMeta[]
  firstDate: string | null
  lastDate: string | null
  updatedAt: string
}

const configId = (companyId: string, assetId: string) => `${companyId}_${assetId}`
const dayId = (companyId: string, assetId: string, date: string) => `${companyId}_${assetId}_${date}`

export function defaultVibrationConfig(companyId: string, assetId: string): VibrationConfig {
  return {
    id: configId(companyId, assetId),
    companyId,
    assetId,
    sensorLabels: {},
    limits: ISO_PRESETS.rigid,
    base: 'rigid',
    series: [],
    firstDate: null,
    lastDate: null,
    updatedAt: new Date().toISOString(),
  }
}

export async function listVibrationConfigs(companyId: string): Promise<VibrationConfig[]> {
  const snap = await (await adminDbFor(companyId)).collection('vibration_config').where('companyId', '==', companyId).get()
  return snap.docs.map((d) => ({ ...(d.data() as VibrationConfig), id: d.id }))
}

export async function getVibrationDays(companyId: string, assetId: string, dates: string[]): Promise<VibDayPayload[]> {
  if (dates.length === 0) return []
  const db = await adminDbFor(companyId)
  const refs = dates.map((d) => db.collection('vibration_days').doc(dayId(companyId, assetId, d)))
  const docs = await db.getAll(...refs)
  return docs
    .filter((d) => d.exists && d.data()?.companyId === companyId && d.data()?.assetId === assetId)
    .map((d) => ({ date: d.data()!.date as string, series: d.data()!.series as VibDayPayload['series'] }))
}

/** Grava um dia importado, juntando-o ao que já existia (reimportar o mesmo período não duplica). */
export async function saveVibrationDay(companyId: string, assetId: string, day: VibDayPayload, series: VibSeriesMeta[]): Promise<void> {
  const db = await adminDbFor(companyId)
  const ref = db.collection('vibration_days').doc(dayId(companyId, assetId, day.date))
  const cfgRef = db.collection('vibration_config').doc(configId(companyId, assetId))
  await db.runTransaction(async (tx) => {
    const [existing, cfgSnap] = await Promise.all([tx.get(ref), tx.get(cfgRef)])
    if (existing.exists && existing.data()?.companyId !== companyId) throw new Error('Dados de outra empresa.')
    if (cfgSnap.exists && cfgSnap.data()?.companyId !== companyId) throw new Error('Dados de outra empresa.')
    const old = (existing.exists ? existing.data()?.series : {}) as VibDayPayload['series']
    const merged: VibDayPayload['series'] = { ...old }
    for (const [key, s] of Object.entries(day.series)) merged[key] = mergeSeriesDay(old?.[key], s)
    tx.set(ref, { companyId, assetId, date: day.date, series: merged, updatedAt: new Date().toISOString() })

    const cfg = cfgSnap.exists ? (cfgSnap.data() as VibrationConfig) : defaultVibrationConfig(companyId, assetId)
    const known = new Map((cfg.series ?? []).map((m) => [m.key, m]))
    for (const m of series) if (!known.has(m.key)) known.set(m.key, m)
    tx.set(cfgRef, {
      ...cfg,
      id: cfgRef.id,
      companyId,
      assetId,
      series: [...known.values()],
      firstDate: !cfg.firstDate || day.date < cfg.firstDate ? day.date : cfg.firstDate,
      lastDate: !cfg.lastDate || day.date > cfg.lastDate ? day.date : cfg.lastDate,
      updatedAt: new Date().toISOString(),
    })
  })
}

export async function updateVibrationSettings(
  companyId: string,
  assetId: string,
  data: Pick<VibrationConfig, 'sensorLabels' | 'limits' | 'base'>,
): Promise<void> {
  const db = await adminDbFor(companyId)
  const ref = db.collection('vibration_config').doc(configId(companyId, assetId))
  const snap = await ref.get()
  if (snap.exists && snap.data()?.companyId !== companyId) throw new Error('Dados de outra empresa.')
  const base = snap.exists ? (snap.data() as VibrationConfig) : defaultVibrationConfig(companyId, assetId)
  await ref.set({ ...base, ...data, companyId, assetId, updatedAt: new Date().toISOString() })
}
