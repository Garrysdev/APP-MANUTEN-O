import { docRecordsFromTasks } from './doc-archive'

describe('docRecordsFromTasks', () => {
  it('um registo por FR preenchida e por IT confirmada, com assinatura e dados da OT', () => {
    const records = docRecordsFromTasks([
      {
        id: 't1', title: 'Controlo UPS', area: '40', tag: '40 UPS1', otNumber: 263,
        createdAt: '2026-10-01', completedAt: null,
        completedFRs: {
          FR18: { p0_b5_r0_c1: '230V', _signedByName: 'RuiG', _signedAt: '2026-10-20T08:00:00Z' },
          _itAcks: { IT1: { byId: 'u1', byName: 'Rui Garrido', at: '2026-10-21T08:00:00Z' } },
        },
        acknowledgedITs: ['IT1'],
      },
      { id: 't2', title: 'Sem docs', createdAt: '2026-10-02', completedFRs: null, acknowledgedITs: [] },
    ])
    expect(records).toEqual([
      { kind: 'IT', docId: 'IT1', taskId: 't1', otNumber: 263, taskTitle: 'Controlo UPS', area: '40', tag: '40 UPS1', date: '2026-10-21T08:00:00Z', signedBy: 'Rui Garrido' },
      { kind: 'FR', docId: 'FR18', taskId: 't1', otNumber: 263, taskTitle: 'Controlo UPS', area: '40', tag: '40 UPS1', date: '2026-10-20T08:00:00Z', signedBy: 'RuiG' },
    ])
  })

  it('registos antigos sem assinatura usam a data de gravação e ficam sem assinante', () => {
    const [r] = docRecordsFromTasks([{ id: 't3', title: 'x', createdAt: '2026-01-01', completedFRs: { FR1: { a: '1', _savedAt: '2026-02-02' } } }])
    expect(r.date).toBe('2026-02-02')
    expect(r.signedBy).toBeNull()
  })
})
