import { deriveTaskStatus } from './task-status'

describe('deriveTaskStatus', () => {
  it('Início preenchido passa a Em Curso', () => {
    expect(deriveTaskStatus('pending', '2026-10-23T09:00', '')).toBe('in_progress')
    expect(deriveTaskStatus('prazo', '2026-10-23T09:00', null)).toBe('in_progress')
  })
  it('Fim preenchido passa a Concluída', () => {
    expect(deriveTaskStatus('pending', '2026-10-23T09:00', '2026-10-23T12:00')).toBe('done')
    expect(deriveTaskStatus('in_progress', '', '2026-10-23T12:00')).toBe('done')
  })
  it('limpar o Fim de uma OT iniciada volta a Em Curso, não a Pendente', () => {
    expect(deriveTaskStatus('done', '2026-10-23T09:00', '')).toBe('in_progress')
  })
  it('sem datas volta a Pendente', () => {
    expect(deriveTaskStatus('in_progress', '', '')).toBe('pending')
    expect(deriveTaskStatus('done', null, null)).toBe('pending')
    expect(deriveTaskStatus('prazo', '', '')).toBe('prazo')
  })
  it('Cancelada não muda', () => {
    expect(deriveTaskStatus('cancelled', '2026-10-23T09:00', '2026-10-23T12:00')).toBe('cancelled')
  })
})
