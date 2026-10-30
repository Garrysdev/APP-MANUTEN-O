import type { MaintenancePlan, Task } from '@/types/models'
import { isPlanTask } from './pm-status'
import { planCurrentDate } from './pm-schedule'

// Cumprimento do PM de um ano (definição do Rui, 30/10/2026):
//   cada plano é UMA OT de PM do ano → % = planos com a OT concluída no ano ÷ nº de planos.
// Ex.: 2026 tem 601 planos = 601 OT de PM; feitas = planos com alguma execução concluída
// em 2026 (OT de PM concluída ligada ao plano, ou execução no histórico do plano —
// incluindo as concluídas em bloco na implementação, até 31/10/2026).
// NÃO somar execuções (uma por mês/semana): isso dava "3217 de 3825", que não é o KPI.
//
// Os anos sem registos na app usam a folha PL-MAN-01 importada (src/lib/historical-kpis.ts):
// o KPI da própria folha — planos cumpridos ÷ planos. Sem nada disso a % fica null.

export interface PmCompliance {
  /** OT de PM do ano (uma por plano). */
  total: number
  /** Concluídas no ano. */
  done: number
  /** Por fazer (total − concluídas). */
  pending: number
  /** Das por fazer, as que já passaram da data. */
  overdue: number
  pct: number | null
  source: 'app' | 'excel' | null
}

/** KPI de PM de um ano importado de uma folha PL-MAN-01. */
export interface HistoricalPmKpi {
  year: number
  /** Intervenções devidas e realizadas (soma de todas as linhas do plano). */
  due: number
  done: number
  /** Realizadas contando no máximo as devidas de cada plano (as "a mais" não contam). */
  doneCapped?: number
  plans: number
  plansOk: number
  file?: string
}

const day = (v?: string | null) => (v ? String(v).slice(0, 10) : '')
const taskDay = (t: Task) => day(t.dueDate || t.plannedStartDate || t.completedAt)
const pctOf = (a: number, b: number) => Math.round((a / b) * 1000) / 10

/** Índice das OT concluídas por plano (id) e por TAG, para não comparar cada plano com todas. */
function indexTasks(tasks: Task[]) {
  const byPlan = new Map<string, Task[]>()
  const byTag = new Map<string, Task[]>()
  for (const t of tasks) {
    if (t.status !== 'done') continue
    const push = (m: Map<string, Task[]>, k: string) => { const l = m.get(k); if (l) l.push(t); else m.set(k, [t]) }
    if (t.maintenancePlanId) push(byPlan, t.maintenancePlanId)
    if (t.tag) push(byTag, t.tag.trim().toLowerCase())
  }
  return (p: MaintenancePlan) => {
    const seen = new Set<Task>()
    const out: Task[] = []
    for (const t of [...(byPlan.get(p.id) || []), ...(byPlan.get((p as { code?: string }).code || '') || []), ...(byTag.get((p.tag || '').trim().toLowerCase()) || [])]) {
      if (!seen.has(t) && isPlanTask(p, t)) { seen.add(t); out.push(t) }
    }
    return out
  }
}

export function fromHistorical(h: HistoricalPmKpi): PmCompliance {
  const done = Math.min(h.plansOk, h.plans)
  return { total: h.plans, done, pending: h.plans - done, overdue: h.plans - done, pct: h.plans > 0 ? pctOf(done, h.plans) : null, source: 'excel' }
}

export function pmComplianceByYear(
  plans: MaintenancePlan[], tasks: Task[], years: number[], today: string, historical: HistoricalPmKpi[] = [],
): Map<number, PmCompliance> {
  const doneTasksOf = indexTasks(tasks)
  const thisYear = Number(today.slice(0, 4))
  const done = new Map<number, number>()
  const overdue = new Map<number, number>()
  const histYears = new Set<number>()
  const add = (m: Map<number, number>, y: number) => m.set(y, (m.get(y) || 0) + 1)
  for (const p of plans) {
    const linked = doneTasksOf(p)
    const doneYears = new Set<number>()
    for (const e of p.executionHistory || []) {
      const y = Number(day(e.date).slice(0, 4))
      if (y) { doneYears.add(y); histYears.add(y) }
    }
    for (const t of linked) {
      const y = Number(taskDay(t).slice(0, 4))
      if (y) doneYears.add(y)
    }
    doneYears.forEach((y) => add(done, y))
    if (p.active === false) continue
    const lastDone = linked.map((t) => day(t.completedAt)).filter(Boolean).sort().pop() || null
    const current = planCurrentDate(p, today, lastDone)
    if (current && current < today && !doneYears.has(Number(current.slice(0, 4)))) add(overdue, Number(current.slice(0, 4)))
  }
  const histByYear = new Map(historical.map((h) => [h.year, h]))
  return new Map(years.map((y) => {
    const d = done.get(y) || 0
    // Anos com o plano na app: o ano corrente e os seguintes, ou um ano passado com execuções registadas.
    const measurable = plans.length > 0 && (y >= thisYear || histYears.has(y))
    const h = histByYear.get(y)
    if (!measurable && h) return [y, fromHistorical(h)]
    const total = measurable ? plans.length : 0
    return [y, {
      total, done: measurable ? Math.min(d, total) : d, pending: Math.max(0, total - d), overdue: overdue.get(y) || 0,
      pct: measurable ? pctOf(Math.min(d, total), total) : null, source: measurable ? 'app' : null,
    }]
  }))
}

export function pmComplianceForYear(plans: MaintenancePlan[], tasks: Task[], year: number, today: string, historical: HistoricalPmKpi[] = []): PmCompliance {
  return pmComplianceByYear(plans, tasks, [year], today, historical).get(year)!
}
