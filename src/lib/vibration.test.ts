import { createVibrationAggregator, parseSeriesName, parseTimestamp, mergeSeriesDay, zoneOf, linearTrend, daysToLimit, ISO_PRESETS, BUCKETS_PER_DAY } from './vibration'

describe('vibration', () => {
  it('reconhece sensor e métrica no nome da série', () => {
    expect(parseSeriesName('"Trend_SGM_SGM_R3_VIB1_vRMS_Valor ValueY"')).toMatchObject({ key: 'VIB1__vRMS', sensor: 'VIB1', metric: 'vRMS', unit: 'mm/s' })
    const cur = parseSeriesName('Trend_Electricidade_Leituras_SGE_Eletricidade_B_Agua.I_Corrente_L1 ValueY')
    expect(cur.sensor).toBe('OUTROS')
    expect(cur.unit).toBe('A')
    expect(cur.key).not.toMatch(/[.\s]/)
  })

  it('lê datas US com AM/PM e D/M 24h', () => {
    expect(new Date(parseTimestamp('7/1/2026 4:06:27 PM')!).getHours()).toBe(16)
    expect(new Date(parseTimestamp('7/1/2026 12:05:00 AM')!).getHours()).toBe(0)
    const pt = new Date(parseTimestamp('13/07/2026 09:30:00')!)
    expect([pt.getDate(), pt.getMonth()]).toEqual([13, 6])
    expect(parseTimestamp('lixo')).toBeNull()
  })

  it('agrega em intervalos de 10 min e converte vRMS de m/s para mm/s', () => {
    const agg = createVibrationAggregator()
    agg.push('﻿"Trend_X_VIB1_vRMS_Valor Time";"Trend_X_VIB1_vRMS_Valor ValueY";"Trend_X_VIB1_Temperatura_Valor Time";"Trend_X_VIB1_Temperatura_Valor ValueY";"Trend_X_VIB1_aRMS_Valor Time";"Trend_X_VIB1_aRMS_Valor ValueY";"Trend_E_B_Agua.I_Corrente_L1 Time";"Trend_E_B_Agua.I_Corrente_L1 ValueY"')
    agg.push('7/1/2026 4:00:10 PM;0.0010;7/1/2026 4:00:10 PM;34;7/1/2026 4:00:10 PM;0.3;7/1/2026 4:00:10 PM;108')
    agg.push('7/1/2026 4:05:10 PM;0.0020;7/1/2026 4:05:10 PM;36')
    agg.push('7/1/2026 4:12:00 PM;0.0030;;')
    const r = agg.finish()
    expect(r.rows).toBe(3)
    expect(r.days).toHaveLength(1)
    const v = r.days[0].series.VIB1__vRMS
    const b = (16 * 60) / 10
    expect(v.min[b]).toBe(1)
    expect(v.max[b]).toBe(2)
    expect(v.avg[b]).toBe(1.5)
    expect(v.avg[b + 1]).toBe(3)
    expect(v.avg).toHaveLength(BUCKETS_PER_DAY)
    expect(r.days[0].series.VIB1__Temperatura.avg[b]).toBe(35)
    expect(r.days[0].series.VIB1__aRMS.avg[b]).toBeCloseTo(2.942, 3) // g → m/s²
    expect(r.series.some((m) => m.sensor === 'OUTROS')).toBe(false)
    expect(Object.keys(r.days[0].series).some((k) => /Corrente/.test(k))).toBe(false)
  })

  it('merge mantém os intervalos antigos que o ficheiro novo não traz', () => {
    const empty = () => Array(BUCKETS_PER_DAY).fill(null)
    const a = { min: empty(), avg: empty(), max: empty() }
    a.avg[0] = 1
    const b = { min: empty(), avg: empty(), max: empty() }
    b.avg[1] = 2
    const m = mergeSeriesDay(a, b)
    expect([m.avg[0], m.avg[1], m.avg[2]]).toEqual([1, 2, null])
  })

  it('zonas ISO e tendência', () => {
    expect(zoneOf(1, ISO_PRESETS.rigid)).toBe('A')
    expect(zoneOf(3, ISO_PRESETS.rigid)).toBe('C')
    expect(zoneOf(5, ISO_PRESETS.rigid)).toBe('D')
    const t = linearTrend([{ x: 0, y: 1 }, { x: 1, y: 1.1 }, { x: 2, y: 1.2 }])
    expect(daysToLimit(t, 2, 2.8)).toBeCloseTo(16, 5)
    expect(daysToLimit(linearTrend([{ x: 0, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 0.5 }]), 2, 2.8)).toBeNull()
  })
})
