import { toNormalizedIsoDate } from '@/lib/utils'

export interface ExcelDateFilterValues {
  periodPreset: string // 'all' | 'this_year' | 'this_month' | 'last_month' | 'last_year' | 'last_30' | 'last_90' | 'custom'
  selectedYear: string // '' ou '2026', '2025', etc.
  selectedMonth: string // '' ou '01'..'12'
  dateFrom: string // 'YYYY-MM-DD'
  dateTo: string // 'YYYY-MM-DD'
}

export const DEFAULT_EXCEL_DATE_FILTER: ExcelDateFilterValues = {
  periodPreset: 'all',
  selectedYear: '',
  selectedMonth: '',
  dateFrom: '',
  dateTo: '',
}

/**
 * Função utilitária para filtrar uma data com base nos valores do filtro Excel
 */
export function filterByExcelDate(
  rawDate: string | null | undefined,
  values: ExcelDateFilterValues
): boolean {
  const active =
    (values.periodPreset && values.periodPreset !== 'all') ||
    Boolean(values.selectedYear || values.selectedMonth || values.dateFrom || values.dateTo)
  // Sem data (ex. OT ainda sem Fim): só passa quando o filtro está em "Todos". Antes
  // passava sempre, e um filtro de período parecia não fazer nada.
  if (!rawDate) return !active

  const iso = toNormalizedIsoDate(rawDate)
  if (!iso) return !active

  const dateStr = iso.slice(0, 10) // 'YYYY-MM-DD'
  const yearStr = iso.slice(0, 4)  // 'YYYY'
  const monthStr = iso.slice(5, 7) // 'MM'

  const today = new Date()
  const currentYearNum = today.getFullYear()
  const currentMonthNum = today.getMonth() + 1

  // 1. Presets Rápidos
  if (values.periodPreset && values.periodPreset !== 'all' && values.periodPreset !== 'custom') {
    if (values.periodPreset === 'this_year') {
      return yearStr === String(currentYearNum)
    }
    if (values.periodPreset === 'this_month') {
      const curYearMonth = `${currentYearNum}-${String(currentMonthNum).padStart(2, '0')}`
      return dateStr.slice(0, 7) === curYearMonth
    }
    if (values.periodPreset === 'last_month') {
      const lmDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lmYearMonth = `${lmDate.getFullYear()}-${String(lmDate.getMonth() + 1).padStart(2, '0')}`
      return dateStr.slice(0, 7) === lmYearMonth
    }
    if (values.periodPreset === 'last_year') {
      return yearStr === String(currentYearNum - 1)
    }
    if (values.periodPreset === 'last_30') {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(today.getDate() - 30)
      const tIso = thirtyDaysAgo.toISOString().slice(0, 10)
      return dateStr >= tIso && dateStr <= today.toISOString().slice(0, 10)
    }
    if (values.periodPreset === 'last_90') {
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(today.getDate() - 90)
      const nIso = ninetyDaysAgo.toISOString().slice(0, 10)
      return dateStr >= nIso && dateStr <= today.toISOString().slice(0, 10)
    }
  }

  // 2. Personalizado ou Seleções Específicas (Ano, Mês ou Intervalo)
  if (values.selectedYear && yearStr !== values.selectedYear) return false
  if (values.selectedMonth && monthStr !== values.selectedMonth) return false
  if (values.dateFrom && dateStr < values.dateFrom) return false
  if (values.dateTo && dateStr > values.dateTo) return false

  return true
}
