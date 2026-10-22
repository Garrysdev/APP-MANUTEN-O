import { signCompletedFRs, frSignature, itSignature, IT_ACKS_KEY } from './doc-signatures'

const rui = { id: 'u1', name: 'Rui Garrido' }
const tec = { id: 'u2', name: 'RuiG' }

describe('signCompletedFRs', () => {
  it('assina uma FR nova com o utilizador da sessão, ignorando a assinatura enviada pelo cliente', () => {
    const out = signCompletedFRs(null, { FR1: { c1: '230V', _signedByName: 'Forjado' } }, tec, '2026-10-22T10:00:00Z')
    expect(out).toEqual({ FR1: { c1: '230V', _signedById: 'u2', _signedByName: 'RuiG', _signedAt: '2026-10-22T10:00:00Z' } })
  })

  it('mantém a assinatura original de uma FR que não mudou', () => {
    const prev = { FR1: { c1: '230V', _signedById: 'u2', _signedByName: 'RuiG', _signedAt: 'T1' } }
    const out = signCompletedFRs(prev, { FR1: { c1: '230V', _savedAt: 'T2', _signedByName: 'Outro' } }, rui, 'T3')
    expect(frSignature(out!.FR1)).toEqual({ name: 'RuiG', at: 'T1' })
  })

  it('volta a assinar quando o conteúdo muda', () => {
    const prev = { FR1: { c1: '230V', _signedById: 'u2', _signedByName: 'RuiG', _signedAt: 'T1' } }
    const out = signCompletedFRs(prev, { FR1: { c1: '231V' } }, rui, 'T3')
    expect(frSignature(out!.FR1)).toEqual({ name: 'Rui Garrido', at: 'T3' })
  })

  it('assina as ITs confirmadas de novo e mantém quem confirmou as anteriores', () => {
    const prev = { [IT_ACKS_KEY]: { IT1: { byId: 'u2', byName: 'RuiG', at: 'T1' } } }
    const out = signCompletedFRs(prev, prev, rui, 'T2', { prev: ['IT1'], next: ['IT1', 'IT2'] })
    expect(itSignature(out, 'IT1')).toEqual({ byId: 'u2', byName: 'RuiG', at: 'T1' })
    expect(itSignature(out, 'IT2')).toEqual({ byId: 'u1', byName: 'Rui Garrido', at: 'T2' })
  })

  it('não deixa o cliente forjar confirmações de IT', () => {
    const forged = { [IT_ACKS_KEY]: { IT9: { byId: 'x', byName: 'Forjado', at: 'T0' } } }
    const out = signCompletedFRs(null, forged, rui, 'T1', { prev: [], next: [] })
    expect(out).toBeNull()
  })
})
