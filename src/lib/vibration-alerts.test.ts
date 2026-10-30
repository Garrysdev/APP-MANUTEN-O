import { BUCKETS_PER_DAY, ISO_PRESETS, type VibDayPayload } from './vibration'
import { findAlerts } from './vibration-view'

const flat = (v: number | null) => Array.from({ length: BUCKETS_PER_DAY }, () => v)
const serie = (avg: (number | null)[]) => ({ min: avg, avg, max: avg })

describe('findAlerts', () => {
  it('dá a hora do pico e a temperatura e corrente nesse momento', () => {
    const vib = flat(1); vib[60] = 5 // 10:00
    const cur = flat(20); cur[60] = 31.5
    const day: VibDayPayload = {
      date: '2026-10-20',
      series: { VIB1__vRMS: serie(vib), VIB1__Temperatura: serie(flat(55)), Agitador_I: serie(cur) },
    }
    const [a] = findAlerts([day], ['VIB1'], ISO_PRESETS.rigid, [{ key: 'Agitador_I', label: 'Corrente' }])
    expect(a).toMatchObject({ kind: 'vibração', value: 5, level: 'perigo', temperature: 55, currents: [{ label: 'Corrente', value: 31.5 }] })
    expect(new Date(a.t).getHours()).toBe(10)
  })

  it('sem alertas abaixo dos limites (a corrente nunca dá alerta)', () => {
    const day: VibDayPayload = { date: '2026-10-20', series: { VIB1__vRMS: serie(flat(1)), Agitador_I: serie(flat(999)) } }
    expect(findAlerts([day], ['VIB1'], ISO_PRESETS.rigid, [{ key: 'Agitador_I', label: 'Corrente' }])).toEqual([])
  })
})
