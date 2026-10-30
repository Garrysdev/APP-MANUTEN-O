import { parseHistorySheet, cellDate, tipoFromTi, historyKey } from './history-import'

describe('history-import', () => {
  it('lê a folha UR pelos títulos das colunas', () => {
    const rows = [
      [null, null, null],
      ['ID', 'STS', 'DATA', 'ÁREA', 'EQUI. / TAG', 'TI', null, 'AVARIA', 'TÉCNICOS', 'INÍCIO', 'FIM', 'ACÇÃO'],
      [220001, 'OK', new Date(2022, 0, 10), '140', '140 T1', 'Pi', null, 'Fuga bomba', 'LM+MS', new Date(2022, 0, 10), new Date(2022, 0, 11), 'Trocado empanque'],
      [null, null, null, '80'], // sem data: ignorada
    ]
    expect(parseHistorySheet(rows)).toEqual([{
      line: 3, excelId: '220001', date: '2022-01-10', area: '140', tag: '140 T1', ti: 'PI',
      title: 'Fuga bomba', action: 'Trocado empanque', techs: 'LM+MS', start: '2022-01-10', end: '2022-01-11',
    }])
  })

  it('datas, tipos e chave', () => {
    expect(cellDate(44571)).toBe('2022-01-10')
    expect(cellDate('5/3/2022')).toBe('2022-03-05')
    expect(tipoFromTi('Mc')).toBe('curativa')
    expect(tipoFromTi('PM')).toBe('plano')
    expect(tipoFromTi('?')).toBe('outro')
    expect(historyKey({ date: '2022-01-10T00:00:00', area: '140', tag: '140  T1', title: 'Fuga ' })).toBe('2022-01-10|140|140 t1|fuga')
  })
})
