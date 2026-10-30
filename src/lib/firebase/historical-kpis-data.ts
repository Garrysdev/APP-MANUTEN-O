// KPI de PM dos anos antes da app (importados das folhas PL-MAN-01 do Excel, ver
// src/lib/historical-kpis.ts). historical_kpis/<companyId>: { pm: { "2019": {...}, ... } }.
// Um só documento por empresa — 1 leitura, em cache até haver nova importação.
import 'server-only'
import { unstable_cache, revalidateTag } from 'next/cache'
import { adminDbFor } from './tenant-db'
import type { HistoricalPmKpi } from '../pm-compliance'

const tag = (companyId: string) => `historical-kpis:${companyId}`
const ref = async (companyId: string) => (await adminDbFor(companyId)).collection('historical_kpis').doc(companyId)

async function read(companyId: string): Promise<HistoricalPmKpi[]> {
  const snap = await (await ref(companyId)).get()
  const pm = (snap.exists ? snap.data()?.pm : null) as Record<string, HistoricalPmKpi> | null
  return Object.values(pm || {}).sort((a, b) => a.year - b.year)
}

export async function getHistoricalPmKpis(companyId: string): Promise<HistoricalPmKpi[]> {
  try {
    return await unstable_cache(read, ['historical-pm-kpis'], { revalidate: 86_400, tags: [tag(companyId)] })(companyId)
  } catch (err) {
    console.error('[getHistoricalPmKpis]', err)
    return []
  }
}

export async function saveHistoricalPmKpis(companyId: string, kpis: HistoricalPmKpi[]): Promise<void> {
  const pm = Object.fromEntries(kpis.map((k) => [String(k.year), k]))
  await (await ref(companyId)).set({ companyId, pm, updatedAt: new Date().toISOString() }, { merge: true })
  revalidateTag(tag(companyId))
}

export async function deleteHistoricalPmKpi(companyId: string, year: number): Promise<void> {
  const { FieldValue } = await import('firebase-admin/firestore')
  await (await ref(companyId)).set({ pm: { [String(year)]: FieldValue.delete() }, updatedAt: new Date().toISOString() }, { merge: true })
  revalidateTag(tag(companyId))
}
