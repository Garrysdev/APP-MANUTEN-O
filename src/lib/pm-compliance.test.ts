import type { MaintenancePlan, Task } from '@/types/models'
import { pmComplianceByYear, pmComplianceForYear } from './pm-compliance'

const plan = (id: string, extra: Partial<MaintenancePlan> = {}) =>
  ({ id, companyId: 'c', title: `Plano ${id}`, tag: `T${id}`, periodicidade: 'mensal', active: true, ...extra }) as unknown as MaintenancePlan
const task = (extra: Partial<Task>) => ({ id: 'x', companyId: 'c', title: 't', status: 'done', ...extra }) as unknown as Task

describe('pm-compliance', () => {
  it('uma OT por plano: planos com a OT concluída no ano ÷ nº de planos', () => {
    const plans = [
      // mensal com 10 execuções em bloco conta como UMA OT feita
      plan('a', { nextDueDate: '2026-11-15', executionHistory: Array.from({ length: 10 }, (_, i) => ({ date: `2026-${String(i + 1).padStart(2, '0')}-15`, doneAt: '2026-10-30', bulk: true })) }),
      plan('b', { periodicidade: 'anual', nextDueDate: '2026-10-01' }), // em atraso
      plan('c', { periodicidade: 'anual', nextDueDate: '2026-12-01' }), // por fazer
      plan('d', { periodicidade: 'anual', nextDueDate: '2027-03-01' }),
    ]
    const tasks = [task({ id: 't1', maintenancePlanId: 'd', dueDate: '2026-03-01' })]
    expect(pmComplianceForYear(plans, tasks, 2026, '2026-10-30')).toEqual({ total: 4, done: 2, pending: 2, overdue: 1, pct: 50, source: 'app' })
  })

  it('anos antigos só com OT do histórico do Excel ficam sem % — ou com o KPI do PL-MAN-01', () => {
    const plans = [plan('a', { nextDueDate: '2026-12-01' })]
    const tasks = [task({ id: 'h', tag: 'Ta', title: 'Plano a', dueDate: '2019-03-01' })]
    expect(pmComplianceByYear(plans, tasks, [2019], '2026-10-30').get(2019)).toMatchObject({ done: 1, pct: null, source: null })
    const hist = [{ year: 2019, due: 2093, done: 2400, doneCapped: 2050, plans: 483, plansOk: 470 }]
    expect(pmComplianceByYear(plans, tasks, [2019], '2026-10-30', hist).get(2019)).toEqual({ total: 483, done: 470, pending: 13, overdue: 13, pct: 97.3, source: 'excel' })
  })
})
