import { addStep, planPeriodStep, planCurrentDate, nextPlanDate, planRowStatus, pmTableStatus, nextStopDate, bianualStopDate } from './pm-schedule'

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

  it('Bianual: a seguinte vai sempre para a próxima paragem (agosto ou dezembro)', () => {
    expect(nextStopDate('2026-08-08')).toBe('2026-12-21')
    expect(nextStopDate('2026-12-21')).toBe('2027-08-08')
    expect(nextStopDate('2027-02-08')).toBe('2027-08-08')
    expect(nextPlanDate({ periodicidade: 'bianual' }, '2026-08-08', '2026-10-30')).toBe('2026-12-21')
    expect(nextPlanDate({ periodicidade: 'bianual' }, '2026-12-21', '2026-12-22')).toBe('2027-08-08')
    // em atraso: nunca abre outra já em atraso
    expect(nextPlanDate({ periodicidade: 'bianual' }, '2025-08-08', '2026-10-30')).toBe('2026-12-21')
    // semestral continua de 6 em 6 meses
    expect(nextPlanDate({ periodicidade: 'semestral' }, '2026-08-08', '2026-10-30')).toBe('2027-02-08')
    // acerto das próximas datas já gravadas fora das paragens
    expect(bianualStopDate({ periodicidade: 'bianual', nextDueDate: '2027-02-08', executionHistory: [{ date: '2026-08-08', doneAt: '2026-10-29' }] })).toBe('2026-12-21')
    expect(bianualStopDate({ periodicidade: 'bianual', nextDueDate: '2026-12-21' })).toBeNull()
    expect(bianualStopDate({ periodicidade: 'bianual', nextDueDate: '2027-03-01' })).toBe('2027-08-08')
    expect(bianualStopDate({ periodicidade: 'anual', nextDueDate: '2027-03-01' })).toBeNull()
  })

  it('uma OT concluída de uma execução anterior não é a OT atual', () => {
    expect(planRowStatus({ status: 'done' }, '2026-11-15')).toBe('pending')
    expect(planRowStatus({ status: 'done' }, null)).toBe('done')
    expect(planRowStatus({ status: 'in_progress' }, '2026-11-15')).toBe('in_progress')
    expect(planRowStatus(null, '2026-11-15')).toBe('pending')
  })

  it('na tabela do PM fica Concluída até chegar a data da OT seguinte', () => {
    const today = '2026-11-04'
    // Acabada de concluir: a seguinte é no futuro.
    expect(pmTableStatus({ status: 'done' }, '2026-11-11', today, true)).toBe('done')
    expect(pmTableStatus(null, '2027-08-07', today, true)).toBe('done')
    // Chegou (ou passou) a data da seguinte: volta a Pendente.
    expect(pmTableStatus({ status: 'done' }, '2026-11-04', today, true)).toBe('pending')
    expect(pmTableStatus(null, '2026-11-01', today, true)).toBe('pending')
    // OT seguinte já criada mas por começar: continua Concluída; nunca executado: Pendente; Em Curso mantém-se.
    expect(pmTableStatus(null, '2026-12-01', today, false)).toBe('pending')
    expect(pmTableStatus({ status: 'pending' }, '2026-12-01', today, true)).toBe('done')
    expect(pmTableStatus({ status: 'pending' }, '2026-12-01', today, false)).toBe('pending')
    expect(pmTableStatus({ status: 'in_progress' }, '2026-12-01', today, true)).toBe('in_progress')
  })
})
