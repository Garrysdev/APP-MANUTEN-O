import type { MaintenancePlan, Task } from '@/types/models'
import { pmComplianceByYear, pmComplianceForYear } from './pm-compliance'

const plan = (id: string, extra: Partial<MaintenancePlan> = {}) =>
  ({ id, companyId: 'c', title: `Plano ${id}`, tag: `T${id}`, periodicidade: 'mensal', active: true, ...extra }) as unknown as MaintenancePlan
const task = (extra: Partial<Task>) => ({ id: 'x', companyId: 'c', title: 't', status: 'done', ...extra }) as unknown as Task

describe('pm-compliance', () => {
  it('concluídas até hoje ÷ devidas até ao fim do ano (inclui as concluídas em bloco)', () => {
    const plans = [
      // mensal: set e out feitas em bloco, nov e dez por fazer → 2 de 4
      plan('a', { nextDueDate: '2026-11-15', executionHistory: [{ date: '2026-09-15', doneAt: '2026-10-30', bulk: true }, { date: '2026-10-15', doneAt: '2026-10-30', bulk: true }] }),
      // anual, em atraso desde 01/10 → 0 de 1
      plan('b', { periodicidade: 'anual', nextDueDate: '2026-10-01' }),
    ]
    expect(pmComplianceForYear(plans, [], 2026, '2026-10-30')).toEqual({ total: 5, done: 2, pending: 3, overdue: 1, pct: 40, source: 'app' })
  })

  it('soma as OT concluídas ligadas ao plano, sem contar duas vezes as que já estão no histórico', () => {
    const plans = [plan('a', { periodicidade: 'anual', nextDueDate: '2027-05-01', executionHistory: [{ date: '2026-05-01', doneAt: '2026-05-02', taskId: 't1' }] })]
    const tasks = [
      task({ id: 't1', maintenancePlanId: 'a', dueDate: '2026-05-01' }),
      task({ id: 't2', maintenancePlanId: 'a', dueDate: '2026-06-01' }),
    ]
    expect(pmComplianceForYear(plans, tasks, 2026, '2026-10-30')).toMatchObject({ done: 2, pending: 0, pct: 100 })
  })

  it('anos antigos só com OT do histórico do Excel ficam sem % — ou com o KPI do PL-MAN-01', () => {
    const plans = [plan('a', { nextDueDate: '2026-12-01' })]
    const tasks = [task({ id: 'h', tag: 'Ta', title: 'Plano a', dueDate: '2019-03-01' })]
    expect(pmComplianceByYear(plans, tasks, [2019], '2026-10-30').get(2019)).toMatchObject({ done: 1, pct: null, source: null })
    const hist = [{ year: 2019, due: 2093, done: 2400, doneCapped: 2050, plans: 483, plansOk: 470 }]
    expect(pmComplianceByYear(plans, tasks, [2019], '2026-10-30', hist).get(2019)).toEqual({ total: 2093, done: 2050, pending: 43, overdue: 43, pct: 97.9, source: 'excel' })
  })
})
