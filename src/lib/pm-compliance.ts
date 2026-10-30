import type { MaintenancePlan, Task } from '@/types/models'
import { isPlanTask } from './pm-status'
import { planCurrentDate, planPeriodStep, addStep } from './pm-schedule'

// Cumprimento do PM de um ano (definição do Rui, 30/10/2026):
//   % = OT de PM concluídas até hoje ÷ OT de PM devidas no ano inteiro (até 31/12).
// Num ano a decorrer a % sobe ao longo do ano e só chega a 100% se tudo o que estava
// previsto até dezembro for feito.
//
// Na app cada plano tem uma só OT atual (plan.nextDueDate) e as execuções concluídas ficam
// em plan.executionHistory (também as concluídas em bloco na implementação, até 31/10/2026).
//   concluídas = histórico do plano com data prevista no ano + OT de PM concluídas ligadas
//                ao plano nesse ano que não estejam já no histórico;
//   por fazer  = a OT atual e as seguintes (pela periodicidade) que ainda caem no ano;
//   devidas    = concluídas + por fazer.
// Os anos sem execuções registadas na app usam o KPI importado das folhas PL-MAN-01
// (src/lib/historical-kpis.ts): realizadas (no máx. as devidas de cada plano) ÷ devidas.
// Sem nada disso a % fica null — o histórico de OT do Excel só tem as feitas, não as devidas.

export interface PmCompliance {
  /** OT de PM devidas no ano inteiro. */
  total: number
  /** Concluídas (até hoje). */
  done: number
  /** Ainda por fazer no ano (em atraso + até 31/12). */
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

/** Datas da OT atual e das seguintes, por ano, até ao fim do último ano pedido. */
function upcomingByYear(plan: MaintenancePlan, current: string, lastYear: number): Map<number, string[]> {
  const out = new Map<number, string[]>()
  const step = planPeriodStep(plan)
  let d = current
  for (let guard = 0; guard < 500 && Number(d.slice(0, 4)) <= lastYear; guard++) {
    const y = Number(d.slice(0, 4))
    out.set(y, [...(out.get(y) || []), d])
    if (!step) break
    d = addStep(d, step)
  }
  return out
}

export function fromHistorical(h: HistoricalPmKpi): PmCompliance {
  const done = Math.min(h.doneCapped ?? h.done, h.due)
  return { total: h.due, done, pending: h.due - done, overdue: h.due - done, pct: h.due > 0 ? pctOf(done, h.due) : null, source: 'excel' }
}

export function pmComplianceByYear(
  plans: MaintenancePlan[], tasks: Task[], years: number[], today: string, historical: HistoricalPmKpi[] = [],
): Map<number, PmCompliance> {
  const doneTasksOf = indexTasks(tasks)
  const lastYear = Math.max(...years, Number(today.slice(0, 4)))
  const done = new Map<number, number>()
  const pending = new Map<number, number>()
  const overdue = new Map<number, number>()
  const histYears = new Set<number>()
  const add = (m: Map<number, number>, y: number, n = 1) => m.set(y, (m.get(y) || 0) + n)
  for (const p of plans) {
    const hist = p.executionHistory || []
    const inHist = new Set(hist.map((e) => e.taskId).filter(Boolean))
    for (const e of hist) {
      const y = Number(day(e.date).slice(0, 4))
      if (y) { add(done, y); histYears.add(y) }
    }
    const linked = doneTasksOf(p)
    for (const t of linked) {
      if (inHist.has(t.id)) continue
      const y = Number(taskDay(t).slice(0, 4))
      if (y) add(done, y)
    }
    if (p.active === false) continue
    const lastDone = linked.map((t) => day(t.completedAt)).filter(Boolean).sort().pop() || null
    const current = planCurrentDate(p, today, lastDone)
    if (!current) continue
    upcomingByYear(p, current, lastYear).forEach((dates, y) => {
      add(pending, y, dates.length)
      add(overdue, y, dates.filter((d) => d < today).length)
    })
  }
  const thisYear = Number(today.slice(0, 4))
  const histByYear = new Map(historical.map((h) => [h.year, h]))
  return new Map(years.map((y) => {
    const d = done.get(y) || 0
    const pend = pending.get(y) || 0
    const over = overdue.get(y) || 0
    const measurable = d + pend > 0 && (y >= thisYear || over > 0 || histYears.has(y))
    const h = histByYear.get(y)
    if (!measurable && h) return [y, fromHistorical(h)]
    return [y, {
      total: d + pend, done: d, pending: pend, overdue: over,
      pct: measurable ? pctOf(d, d + pend) : null, source: measurable ? 'app' : null,
    }]
  }))
}

export function pmComplianceForYear(plans: MaintenancePlan[], tasks: Task[], year: number, today: string, historical: HistoricalPmKpi[] = []): PmCompliance {
  return pmComplianceByYear(plans, tasks, [year], today, historical).get(year)!
}
