import { parsePlanSheet, yearFromFileName } from './historical-kpis'

describe('historical-kpis', () => {
  it('ano pelo nome do ficheiro', () => {
    expect(yearFromFileName('PL-MAN-01 PLANO MANUTENÇÃO_31_12_2019_3.xlsx')).toBe(2019)
    expect(yearFromFileName('PL-MAN-01_PLANO_MANUTENÇÃO_2018_.xls')).toBe(2018)
    expect(yearFromFileName('PL-MAN-01 PLANO MANUTENÇÃO_01_2026_1.xlsx')).toBe(2026)
    expect(yearFromFileName('plano.xlsx')).toBeNull()
  })

  it('formato 2019+: bloco a seguir a "JAN"', () => {
    const rows = [
      ['AREA', null, 'JAN', 0.99, 42, 'KPI', 0.94],
      [null, null, 'W01', 4, 3, 1, 2],
      ['AREA', 'TAG'],
      [0, 'modelo', 'x', 'x'],
      [30, 'A', null, 2, 2, 1, 1],
      [40, 'B', null, 2, 1, 0, 1],
    ]
    expect(parsePlanSheet(rows, 2023)).toEqual({ year: 2023, due: 4, done: 3, doneCapped: 3, plans: 2, plansOk: 1, file: undefined })
  })

  it('formato 2017/2018: colunas DEVIDAS / REALIZADAS', () => {
    const rows = [
      [], [],
      ['AREA', 'INTERVENÇÕES REALIZADAS', 'INTERVENÇÕES DEVIDAS', 'RACIO'],
      [0, 'x', 'x', 'x'],
      [50, 1, 1, 1],
      [90, 1, 3, 0.33],
    ]
    expect(parsePlanSheet(rows, 2017)).toMatchObject({ due: 4, done: 2, doneCapped: 2, plans: 2, plansOk: 1 })
  })
})
