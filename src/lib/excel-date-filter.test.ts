import { filterByExcelDate, DEFAULT_EXCEL_DATE_FILTER } from './excel-date-filter'

describe('filterByExcelDate', () => {
  it('sem filtro, tudo passa (incluindo sem data)', () => {
    expect(filterByExcelDate(null, DEFAULT_EXCEL_DATE_FILTER)).toBe(true)
    expect(filterByExcelDate('2020-05-01', DEFAULT_EXCEL_DATE_FILTER)).toBe(true)
  })

  it('com filtro ativo, uma OT sem data fica de fora', () => {
    const f = { ...DEFAULT_EXCEL_DATE_FILTER, selectedYear: '2025' }
    expect(filterByExcelDate(null, f)).toBe(false)
    expect(filterByExcelDate('', f)).toBe(false)
  })

  it('filtra por ano, mês e intervalo', () => {
    expect(filterByExcelDate('2025-03-10T00:00:00.000Z', { ...DEFAULT_EXCEL_DATE_FILTER, selectedYear: '2025' })).toBe(true)
    expect(filterByExcelDate('2024-03-10', { ...DEFAULT_EXCEL_DATE_FILTER, selectedYear: '2025' })).toBe(false)
    expect(filterByExcelDate('2025-03-10', { ...DEFAULT_EXCEL_DATE_FILTER, selectedMonth: '04' })).toBe(false)
    expect(filterByExcelDate('2025-03-10', { ...DEFAULT_EXCEL_DATE_FILTER, periodPreset: 'custom', dateFrom: '2025-03-01', dateTo: '2025-03-31' })).toBe(true)
  })
})
