import type { MaintenancePlan, Task } from '@/types/models'
import { calculatePlanAnnualDates } from '@/lib/pm-generator'

// Cada Plano de Manutenção tem uma só OT "atual": a próxima a executar, na data
// plan.nextDueDate. Concluí-la abre a seguinte na data seguinte segundo a periodicidade.
// O Calendário mostra só essa OT atual (a vermelho se estiver em atraso) e a tabela do PM
// mostra a mesma data na coluna PRÓXIMA — mudar a data num sítio muda no outro.

type PlanDates = Partial<Pick<MaintenancePlan, 'periodicidade' | 'periodicidadeLabel' | 'title' | 'description' | 'calendarDates' | 'calendarStartDate' | 'nextDueDate' | 'lastGeneratedAt'>>

type Step = { days?: number; months?: number }

/** Intervalo entre execuções; null quando não há periodicidade fixa (horas, pontual…). */
export function planPeriodStep(plan: Pick<MaintenancePlan, 'periodicidade' | 'periodicidadeLabel'>): Step | null {
  const p = `${plan.periodicidade || ''} ${plan.periodicidadeLabel || ''}`.toLowerCase()
  if (p.includes('diari') || p.includes('diári')) return { days: 1 }
  if (p.includes('quinzenal')) return { days: 14 }
  if (p.includes('semanal')) return { days: 7 }
  if (p.includes('bimensal')) return { months: 2 }
  if (p.includes('quadrimestral')) return { months: 4 }
  if (p.includes('mensal')) return { months: 1 }
  if (p.includes('trimestral')) return { months: 3 }
  if (p.includes('semestral') || p.includes('bianual')) return { months: 6 }
  if (p.includes('trianual')) return { months: 36 }
  if (p.includes('bienal')) return { months: 24 }
  if (p.includes('5 anos')) return { months: 60 }
  if (p.includes('anual')) return { months: 12 }
  return null
}

export function addStep(ymd: string, step: Step): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  if (step.days) {
    const dt = new Date(Date.UTC(y, m - 1, d + step.days))
    return dt.toISOString().slice(0, 10)
  }
  const months = step.months || 0
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  // Mantém o dia do mês; em meses mais curtos fica no último dia (31 jan + 1 mês = 28/29 fev).
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

function ymd(v: string | null | undefined): string | null {
  if (!v) return null
  const s = String(v).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/**
 * Data da OT atual (a próxima a executar) do plano:
 * 1. plan.nextDueDate (gravada ao concluir, ao arrastar no Calendário ou na ficha);
 * 2. senão, a primeira data do calendário-padrão do plano depois da última execução
 *    (lastGeneratedAt) — ou a primeira do ano, se nunca foi executado.
 */
export function planCurrentDate(plan: PlanDates, today: string, lastDone?: string | null): string | null {
  const next = ymd(plan.nextDueDate)
  if (next) return next
  const last = [ymd(plan.lastGeneratedAt), ymd(lastDone)].filter(Boolean).sort().pop() || null
  const startYear = Number((last || today).slice(0, 4))
  const candidates = new Set<string>()
  for (let y = startYear; y <= startYear + 6; y++) {
    calculatePlanAnnualDates(plan, y).forEach((d) => { const v = ymd(d); if (v) candidates.add(v) })
  }
  const sorted = Array.from(candidates).sort()
  if (sorted.length === 0) return null
  if (!last) return sorted.find((d) => d.slice(0, 4) === today.slice(0, 4)) || sorted[0]
  const found = sorted.find((d) => d > last)
  if (found) return found
  // Datas manuais (calendarDates) já todas executadas: continua pela periodicidade.
  const step = planPeriodStep(plan)
  if (!step) return null
  let d = sorted[sorted.length - 1]
  let guard = 0
  while (d <= last && guard++ < 1000) d = addStep(d, step)
  return d
}

/**
 * Data da OT seguinte depois de concluir a OT da data `occurrence`: soma a periodicidade
 * até ficar depois de `after` (por omissão, hoje) — uma OT em atraso concluída hoje não
 * abre logo outra já em atraso. null quando o plano não tem periodicidade fixa.
 */
export function nextPlanDate(plan: PlanDates, occurrence: string, after: string): string | null {
  const step = planPeriodStep(plan)
  if (!step) return null
  let d = addStep(occurrence, step)
  let guard = 0
  while (d <= after && guard++ < 1000) d = addStep(d, step)
  return d
}

export type PmRowStatus = 'pending' | 'in_progress' | 'done'

/**
 * Estado da OT atual do plano. A OT ligada (findPlanLinkedTask) só conta se ainda estiver
 * aberta, ou se o plano já não tem próxima data (ex.: pontual concluído). Uma OT concluída
 * de uma execução anterior não é a OT atual — essa é a próxima, ainda Pendente.
 */
export function planRowStatus(linkedTask: Pick<Task, 'status'> | null, currentDate: string | null): PmRowStatus {
  const s = linkedTask?.status
  if (s === 'in_progress') return 'in_progress'
  if (s === 'done' && !currentDate) return 'done'
  return 'pending'
}

/** A OT ligada é a OT atual (aberta) — senão a OT atual ainda não existe como documento. */
export function isOpenLinkedTask(linkedTask: Pick<Task, 'status'> | null): boolean {
  return Boolean(linkedTask && linkedTask.status !== 'done' && linkedTask.status !== 'cancelled')
}

export function isOverdue(date: string | null, today: string): boolean {
  return Boolean(date && date < today)
}
