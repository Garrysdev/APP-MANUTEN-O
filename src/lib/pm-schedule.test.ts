import { addStep, planPeriodStep, planCurrentDate, nextPlanDate, planRowStatus } from './pm-schedule'

describe('pm-schedule', () => {
  it('soma a periodicidade mantendo o dia (ou o último dia do mês)', () => {
    expect(addStep('2026-01-31', { months: 1 })).toBe('2026-02-28')
    expect(addStep('2026-10-15', { months: 1 })).toBe('2026-11-15')
    expect(addStep('2026-12-28', { days: 7 })).toBe('2027-01-04')
    expect(planPeriodStep({ periodicidade: 'bianual' })).toEqual({ months: 6 })
    expect(planPeriodStep({ periodicidade: 'bimensal' })).toEqual({ months: 2 })
    expect(planPeriodStep({ periodicidade: 'pontual' })).toBeNull()
  })

  it('a data atual é a nextDueDate gravada', () => {
    expect(planCurrentDate({ periodicidade: 'mensal', nextDueDate: '2026-12-03T00:00:00.000Z' }, '2026-10-29')).toBe('2026-12-03')
  })

  it('sem nextDueDate: a 1.ª data-padrão depois da última execução', () => {
    expect(planCurrentDate({ periodicidade: 'mensal', lastGeneratedAt: '2026-10-20' }, '2026-10-29')).toBe('2026-11-15')
    expect(planCurrentDate({ periodicidade: 'anual' }, '2026-10-29')).toBe('2026-08-08')
    expect(planCurrentDate({ periodicidade: 'anual' }, '2026-10-29', '2026-08-10')).toBe('2027-08-08')
  })

  it('concluir abre a seguinte pela periodicidade, nunca já em atraso', () => {
    expect(nextPlanDate({ periodicidade: 'mensal' }, '2026-10-29', '2026-10-29')).toBe('2026-11-29')
    expect(nextPlanDate({ periodicidade: 'mensal' }, '2026-01-15', '2026-10-29')).toBe('2026-11-15')
    expect(nextPlanDate({ periodicidade: 'pontual' }, '2026-10-29', '2026-10-29')).toBeNull()
  })

  it('uma OT concluída de uma execução anterior não é a OT atual', () => {
    expect(planRowStatus({ status: 'done' }, '2026-11-15')).toBe('pending')
    expect(planRowStatus({ status: 'done' }, null)).toBe('done')
    expect(planRowStatus({ status: 'in_progress' }, '2026-11-15')).toBe('in_progress')
    expect(planRowStatus(null, '2026-11-15')).toBe('pending')
  })
})
