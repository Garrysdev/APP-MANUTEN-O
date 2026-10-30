import type { MaintenancePlan, Task } from '@/types/models'
import { pmComplianceByYear, pmComplianceForYear } from './pm-compliance'

const plan = (id: string, extra: Partial<MaintenancePlan> = {}) =>
  ({ id, companyId: 'c', title: `Plano ${id}`, tag: `T${id}`, periodicidade: 'mensal', active: true, ...extra }) as unknown as MaintenancePlan
const task = (extra: Partial<Task>) => ({ id: 'x', companyId: 'c', title: 't', status: 'done', ...extra }) as unknown as Task

describe('pm-compliance', () => {
  it('conta as execuções em bloco e os planos em atraso', () => {
    const plans = [
      plan('a', { nextDueDate: '2026-11-15', executionHistory: [{ date: '2026-09-15', doneAt: '2026-10-30', bulk: true }, { date: '2026-10-15', doneAt: '2026-10-30', bulk: true }] }),
      plan('b', { nextDueDate: '2026-10-01' }), // em atraso
    ]
    expect(pmComplianceForYear(plans, [], 2026, '2026-10-30')).toEqual({ total: 3, done: 2, overdue: 1, plans: 2, plansOk: 1, pct: 50, source: 'app' })
  })

  it('soma as OT concluídas ligadas ao plano, sem contar duas vezes as que já estão no histórico', () => {
    const plans = [plan('a', { nextDueDate: '2026-12-01', executionHistory: [{ date: '2026-05-01', doneAt: '2026-05-02', taskId: 't1' }] })]
    const tasks = [
      task({ id: 't1', maintenancePlanId: 'a', dueDate: '2026-05-01' }),
      task({ id: 't2', maintenancePlanId: 'a', dueDate: '2026-06-01' }),
    ]
    expect(pmComplianceForYear(plans, tasks, 2026, '2026-10-30')).toMatchObject({ done: 2, overdue: 0, pct: 100 })
  })

  it('anos antigos só com OT do histórico do Excel ficam sem % — ou com o KPI do PL-MAN-01', () => {
    const plans = [plan('a', { nextDueDate: '2026-12-01' })]
    const tasks = [task({ id: 'h', tag: 'Ta', title: 'Plano a', dueDate: '2019-03-01' })]
    expect(pmComplianceByYear(plans, tasks, [2019], '2026-10-30').get(2019)).toMatchObject({ done: 1, pct: null, source: null })
    const hist = [{ year: 2019, due: 2093, done: 2400, plans: 483, plansOk: 470 }]
    expect(pmComplianceByYear(plans, tasks, [2019], '2026-10-30', hist).get(2019)).toEqual({ total: 2093, done: 2400, overdue: 0, plans: 483, plansOk: 470, pct: 97.3, source: 'excel' })
  })
})
