import { normalizeDocCode, isValidDocCode } from './doc-code'

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
