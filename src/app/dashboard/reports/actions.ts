'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { saveHistoricalPmKpis, deleteHistoricalPmKpi } from '@/lib/firebase/historical-kpis-data'
import type { HistoricalPmKpi } from '@/lib/pm-compliance'
import type { HistoryRow } from '@/lib/history-import'
import { importHistoricalTasks } from '@/lib/firebase/data'

type Result = { ok: true } | { ok: false; error: string }

const isCount = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1_000_000

async function managerCompany(): Promise<string> {
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Sessão expirada.')
  if (profile.role !== 'manager') throw new Error('Sem permissão.')
  return profile.companyId
}

/** Grava os KPI de PM lidos dos PL-MAN-01 (substitui os anos indicados). */
export async function saveHistoricalPmKpisAction(kpis: HistoricalPmKpi[]): Promise<Result> {
  try {
    const companyId = await managerCompany()
    if (!Array.isArray(kpis) || kpis.length === 0 || kpis.length > 50) throw new Error('Nada para gravar.')
    const clean = kpis.map((k) => {
      const year = Number(k?.year)
      if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Ano inválido.')
      if (![k.due, k.done, k.doneCapped ?? 0, k.plans, k.plansOk].every(isCount) || k.plansOk > k.plans) throw new Error(`Valores inválidos em ${year}.`)
      return { year, due: k.due, done: k.done, doneCapped: Math.min(k.doneCapped ?? k.done, k.due), plans: k.plans, plansOk: k.plansOk, file: String(k.file || '').slice(0, 200) }
    })
    if (new Set(clean.map((k) => k.year)).size !== clean.length) throw new Error('Há anos repetidos.')
    await saveHistoricalPmKpis(companyId, clean)
    revalidatePath('/dashboard/reports')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao gravar.' }
  }
}

export async function deleteHistoricalPmKpiAction(year: number): Promise<Result> {
  try {
    const companyId = await managerCompany()
    if (!Number.isInteger(year)) throw new Error('Ano inválido.')
    await deleteHistoricalPmKpi(companyId, year)
    revalidatePath('/dashboard/reports')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao apagar.' }
  }
}

const ymd = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const txt = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Importa OT do histórico de uma folha FR-MAN-09 (dryRun só conta as novas e as repetidas). */
export async function importHistoryAction(
  rows: HistoryRow[],
  fileName: string,
  dryRun: boolean,
): Promise<{ ok: true; created: number; skipped: number; years: number[] } | { ok: false; error: string }> {
  try {
    const profile = await getCurrentProfile()
    if (!profile) throw new Error('Sessão expirada.')
    if (profile.role !== 'manager') throw new Error('Sem permissão.')
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Nada para importar.')
    if (rows.length > 5000) throw new Error('Demasiadas linhas (máx. 5000 por ficheiro).')
    const clean: HistoryRow[] = rows.flatMap((r) => {
      const date = ymd(r?.date)
      const title = txt(r?.title, 300)
      if (!date || !title) return []
      return [{
        line: Number.isInteger(r.line) ? r.line : 0,
        excelId: txt(r.excelId, 40), date, area: txt(r.area, 40), tag: txt(r.tag, 80), ti: txt(r.ti, 10)?.toUpperCase() ?? null,
        title, action: txt(r.action, 2000), techs: txt(r.techs, 120), start: ymd(r.start), end: ymd(r.end),
      }]
    })
    const source = `FR-MAN-09 (${String(fileName || '').replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 120)})`
    const res = await importHistoricalTasks(profile.companyId, { id: profile.id, name: profile.name }, clean, source, dryRun)
    if (!dryRun) {
      revalidatePath('/dashboard/reports')
      revalidatePath('/dashboard')
      revalidatePath('/dashboard/tasks')
    }
    return { ok: true, ...res }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao importar.' }
  }
}
