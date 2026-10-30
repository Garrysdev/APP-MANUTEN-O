import { BUCKETS_PER_DAY, type VibDayPayload } from './vibration'
import { datesBetween, autoGroup, windowRows, windowStats, windowCsv, dayStartMs } from './vibration-window'

const flat = (v: number | null) => Array.from({ length: BUCKETS_PER_DAY }, () => v)
const series = (avg: (number | null)[]) => ({ min: avg.map((v) => (v === null ? null : v - 1)), avg, max: avg.map((v) => (v === null ? null : v + 1)) })

const days: VibDayPayload[] = [
  { date: '2026-10-01', series: { VIB1__Temperatura: series(flat(40)) } },
  { date: '2026-10-02', series: { VIB1__Temperatura: series(flat(50)) } },
]

describe('vibration-window', () => {
  it('lista as datas do intervalo, inclusive', () => {
    expect(datesBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(datesBetween('2026-11-02', '2026-10-30')).toEqual([])
  })

  it('junta intervalos para ~720 pontos', () => {
    expect(autoGroup(86_400_000)).toBe(1)
    expect(autoGroup(30 * 86_400_000)).toBe(6)
  })

  it('só devolve linhas dentro da janela (zoom)', () => {
    const from = dayStartMs('2026-10-02')
    const rows = windowRows(days, ['VIB1__Temperatura'], { from, to: from + 3_600_000 })
    expect(rows).toHaveLength(7) // 00:00 … 01:00
    expect(rows[0]).toEqual({ t: from, key: 'VIB1__Temperatura', min: 49, avg: 50, max: 51 })
  })

  it('agrupa intervalos: mín dos mínimos, média, máx dos máximos', () => {
    const avg = flat(10); avg[1] = 20
    const rows = windowRows([{ date: '2026-10-01', series: { k: series(avg) } }], ['k'], { from: 0, to: Infinity }, 2)
    expect(rows[0]).toMatchObject({ min: 9, avg: 15, max: 21 })
    expect(rows).toHaveLength(BUCKETS_PER_DAY / 2)
  })

  it('estatísticas da janela', () => {
    const [s] = windowStats(days, ['VIB1__Temperatura'], { from: 0, to: Infinity })
    expect(s).toMatchObject({ min: 39, avg: 45, max: 51, first: 40, last: 50, n: 2 * BUCKETS_PER_DAY })
  })

  it('CSV com vírgula decimal e cabeçalho por série', () => {
    const csv = windowCsv(days, [{ key: 'VIB1__Temperatura', sensor: 'VIB1', metric: 'Temperatura', label: 'VIB1 · Temperatura', unit: '°C' }],
      { from: dayStartMs('2026-10-01'), to: dayStartMs('2026-10-01') }, 1).replace('﻿', '').split('\r\n')
    expect(csv[0]).toBe('Data/hora;VIB1 · Temperatura mín (°C);VIB1 · Temperatura média (°C);VIB1 · Temperatura máx (°C)')
    expect(csv[1]).toBe('2026-10-01 00:00;39;40;41')
  })
})
