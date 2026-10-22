import { normalizeDocCode, isValidDocCode, cleanDocTitle } from './doc-code'

describe('normalizeDocCode', () => {
  it.each([
    ['FR/MAN/07', 'FR-MAN-07'],
    ['FR/MAN/7', 'FR-MAN-07'],
    ['fr man 16', 'FR-MAN-16'],
    ['IT.MAN.2', 'IT-MAN-02'],
    ['FR-MAN-18', 'FR-MAN-18'],
    [' FR - MAN - 39 ', 'FR-MAN-39'],
    ['FR-MAN-5a', 'FR-MAN-05A'],
    ['FR-MAN-120', 'FR-MAN-120'],
    ['', ''],
    [null, ''],
  ])('%p → %p', (raw, expected) => {
    expect(normalizeDocCode(raw)).toBe(expected)
  })
})

describe('cleanDocTitle', () => {
  it.each([
    ['LUBRIFICAÇÃO EMPANQUES AGITADORES 02 01 2025', 'LUBRIFICAÇÃO EMPANQUES AGITADORES'],
    ['LUBRIFICAÇÃO PASTILHADOR ESTER 25 11 2025', 'LUBRIFICAÇÃO PASTILHADOR ESTER'],
    ['LIMPEZA REACTOR_02_01_2025', 'LIMPEZA REACTOR'],
    ['LIGAÇÃO CONSOLA DE PESAGEM 130INK 08 04 2024', 'LIGAÇÃO CONSOLA DE PESAGEM 130INK'],
    ['EFLUENTES SECUNDARIOS rev 02 01 2025', 'EFLUENTES SECUNDARIOS'],
    ['CONTROLO UPS 02-01-25', 'CONTROLO UPS'],
    ['CONTROLO UPS rev 3', 'CONTROLO UPS'],
    ['LIMPEZA REACTOR (LICENÇA TRABALHO)', 'LIMPEZA REACTOR (LICENÇA TRABALHO)'],
    ['TERMOMETROS', 'TERMOMETROS'],
    ['CALDEIRA 2 3', 'CALDEIRA 2 3'],
  ])('%p → %p', (raw, expected) => {
    expect(cleanDocTitle(raw)).toBe(expected)
  })
})

describe('isValidDocCode', () => {
  it('aceita o formato FR-MAN-16 / IT-MAN-02', () => {
    expect(isValidDocCode('FR-MAN-16', 'FR')).toBe(true)
    expect(isValidDocCode('IT-MAN-02', 'IT')).toBe(true)
  })
  it('rejeita prefixo trocado, sem área ou sem número', () => {
    expect(isValidDocCode('IT-MAN-02', 'FR')).toBe(false)
    expect(isValidDocCode('FR-16', 'FR')).toBe(false)
    expect(isValidDocCode('FR-MAN', 'FR')).toBe(false)
    expect(isValidDocCode('FR/MAN/16', 'FR')).toBe(false)
  })
})
