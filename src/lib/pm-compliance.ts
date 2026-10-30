import type { MaintenancePlan, Task } from '@/types/models'
import { isPlanTask } from './pm-status'
import { planCurrentDate } from './pm-schedule'

// Cumprimento do PM de um ano (30/10/2026), igual ao KPI da folha PL-MAN-01 do Excel:
// cada plano com execuções devidas no ano conta como "cumprido" se fez todas as devidas.
//
// Na app cada plano tem uma só OT atual e as execuções concluídas ficam em
// plan.executionHistory (também as "concluídas em bloco", que não criam OT). Antes
// contava "planos com a OT do ano concluída" ÷ "planos existentes" — as execuções em
// bloco nunca entravam e a % não mexia, e nos anos antigos (antes de haver planos na app)
// dava ~1% ao dividir pelos 600 planos de hoje.
//
// execuções feitas = histórico do plano com data prevista no ano + OT de PM concluídas
//                    ligadas ao plano nesse ano que não estejam já no histórico;
// em atraso        = planos ativos cuja OT atual é desse ano e já passou da data;
// planos           = planos com execuções feitas ou em atraso no ano;
// % (KPI)          = planos sem nenhuma em atraso ÷ planos.
// Os anos sem execuções registadas na app usam os KPI importados dos PL-MAN-01 do Excel
// (src/lib/historical-kpis.ts); sem eles a % fica null (o histórico de OT do Excel só
// tem as OT feitas, não as previstas — não há como medir).

export interface PmCompliance {
  /** Execuções previstas até hoje (feitas + em atraso). */
  total: number
  done: number
  overdue: number
  /** Planos com execuções devidas no ano e quantos as fizeram todas. */
  plans: number
  plansOk: number
  /** KPI: plansOk ÷ plans, em %. null quando o ano não tem registos. */
  pct: number | null
  source: 'app' | 'excel' | null
}

/** KPI de PM de um ano importado de uma folha PL-MAN-01. */
export interface HistoricalPmKpi {
  year: number
  /** Intervenções devidas e realizadas (soma de todas as linhas do plano). */
  due: number
  done: number
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
  return {
    total: h.due, done: h.done, overdue: Math.max(0, h.due - h.done),
    plans: h.plans, plansOk: h.plansOk, pct: h.plans > 0 ? pctOf(h.plansOk, h.plans) : null, source: 'excel',
  }
}

export function pmComplianceByYear(
  plans: MaintenancePlan[], tasks: Task[], years: number[], today: string, historical: HistoricalPmKpi[] = [],
): Map<number, PmCompliance> {
  const doneTasksOf = indexTasks(tasks)
  const done = new Map<number, number>()
  const overdue = new Map<number, number>()
  const plansIn = new Map<number, number>()
  const histYears = new Set<number>()
  const add = (m: Map<number, number>, y: number, n = 1) => m.set(y, (m.get(y) || 0) + n)
  for (const p of plans) {
    const hist = p.executionHistory || []
    const inHist = new Set(hist.map((e) => e.taskId).filter(Boolean))
    const yearsOfPlan = new Set<number>()
    for (const e of hist) {
      const y = Number(day(e.date).slice(0, 4))
      if (y) { add(done, y); histYears.add(y); yearsOfPlan.add(y) }
    }
    const linked = doneTasksOf(p)
    for (const t of linked) {
      if (inHist.has(t.id)) continue
      const y = Number(taskDay(t).slice(0, 4))
      if (y) { add(done, y); yearsOfPlan.add(y) }
    }
    if (p.active !== false) {
      const lastDone = linked.map((t) => day(t.completedAt)).filter(Boolean).sort().pop() || null
      const current = planCurrentDate(p, today, lastDone)
      if (current && current < today) { const y = Number(current.slice(0, 4)); add(overdue, y); yearsOfPlan.add(y) }
    }
    yearsOfPlan.forEach((y) => add(plansIn, y))
  }
  const thisYear = Number(today.slice(0, 4))
  const histByYear = new Map(historical.map((h) => [h.year, h]))
  return new Map(years.map((y) => {
    const d = done.get(y) || 0
    const o = overdue.get(y) || 0
    const measurable = d + o > 0 && (y >= thisYear || o > 0 || histYears.has(y))
    const h = histByYear.get(y)
    if (!measurable && h) return [y, fromHistorical(h)]
    const n = plansIn.get(y) || 0
    return [y, {
      total: d + o, done: d, overdue: o, plans: n, plansOk: n - o,
      pct: measurable && n > 0 ? pctOf(n - o, n) : null, source: measurable ? 'app' : null,
    }]
  }))
}

export function pmComplianceForYear(plans: MaintenancePlan[], tasks: Task[], year: number, today: string, historical: HistoricalPmKpi[] = []): PmCompliance {
  return pmComplianceByYear(plans, tasks, [year], today, historical).get(year)!
}
