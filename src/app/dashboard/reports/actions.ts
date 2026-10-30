'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { saveHistoricalPmKpis, deleteHistoricalPmKpi } from '@/lib/firebase/historical-kpis-data'
import type { HistoricalPmKpi } from '@/lib/pm-compliance'

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
      if (![k.due, k.done, k.plans, k.plansOk].every(isCount) || k.plansOk > k.plans) throw new Error(`Valores inválidos em ${year}.`)
      return { year, due: k.due, done: k.done, plans: k.plans, plansOk: k.plansOk, file: String(k.file || '').slice(0, 200) }
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
