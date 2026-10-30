'use client'

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Filter, X, ChevronDown } from 'lucide-react'
import Select from '@/components/ui/Select'

export { DEFAULT_EXCEL_DATE_FILTER, filterByExcelDate } from '@/lib/excel-date-filter'
export type { ExcelDateFilterValues } from '@/lib/excel-date-filter'
import { DEFAULT_EXCEL_DATE_FILTER, type ExcelDateFilterValues } from '@/lib/excel-date-filter'

export const MONTH_NAMES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

interface ExcelColumnDateFilterProps {
  values: ExcelDateFilterValues
  onChange: (newValues: ExcelDateFilterValues) => void
  availableYears?: number[]
  className?: string
}

/**
 * Filtro de Data Estilo Excel incorporado diretamente na célula da coluna da tabela
 */
export function ExcelColumnDateFilter({
  values,
  onChange,
  availableYears,
  className = '',
}: ExcelColumnDateFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  // O popover abre em document.body com posição fixa: dentro da tabela (overflow-x-auto)
  // ficava cortado na última coluna (PRÓXIMA do PM).
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const currentYearNum = new Date().getFullYear()

  const yearsOptions = useMemo(() => {
    if (availableYears && availableYears.length) {
      return Array.from(new Set(availableYears)).sort((a, b) => b - a)
    }
    return [currentYearNum, currentYearNum - 1, currentYearNum - 2, currentYearNum - 3]
  }, [availableYears, currentYearNum])

  const hasActiveFilter =
    (values.periodPreset && values.periodPreset !== 'all') ||
    Boolean(values.selectedYear) ||
    Boolean(values.selectedMonth) ||
    Boolean(values.dateFrom) ||
    Boolean(values.dateTo)

  // Fechar popover ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element
      // A lista dos <Select> do popover abre em document.body (portal) — não é "fora".
      if (target.closest?.('[data-select-list]')) return
      if (popRef.current?.contains(target)) return
      if (ref.current && !ref.current.contains(target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    function place() {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const w = 288 // w-72
      const h = popRef.current?.offsetHeight ?? 380
      const margin = 8
      const left = Math.max(margin, Math.min(r.left, window.innerWidth - w - margin))
      const below = r.bottom + 4
      const top = below + h > window.innerHeight - margin && r.top - h - 4 > margin ? r.top - h - 4 : Math.max(margin, Math.min(below, window.innerHeight - h - margin))
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, values])

  function getButtonLabel(): string {
    if (values.periodPreset === 'this_year') return 'Este Ano'
    if (values.periodPreset === 'this_month') return 'Este Mês'
    if (values.periodPreset === 'last_month') return 'Mês Ant.'
    if (values.periodPreset === 'last_year') return `Ano ${currentYearNum - 1}`
    if (values.periodPreset === 'last_30') return 'Últimos 30d'
    if (values.periodPreset === 'last_90') return 'Últimos 90d'
    if (values.selectedYear && values.selectedMonth) return `${values.selectedMonth}/${values.selectedYear}`
    if (values.selectedYear) return `${values.selectedYear}`
    if (values.selectedMonth) {
      const mObj = MONTH_NAMES.find(m => m.value === values.selectedMonth)
      return mObj ? mObj.label.slice(0, 3) : `Mês ${values.selectedMonth}`
    }
    if (values.dateFrom || values.dateTo) return 'Custom...'
    return 'Data...'
  }

  function updatePreset(preset: string) {
    if (preset === 'all') {
      onChange(DEFAULT_EXCEL_DATE_FILTER)
      setOpen(false)
      return
    }

    if (preset === 'this_year') {
      onChange({
        periodPreset: 'this_year',
        selectedYear: String(currentYearNum),
        selectedMonth: '',
        dateFrom: '',
        dateTo: '',
      })
      setOpen(false)
      return
    }

    if (preset === 'this_month') {
      const curMonthStr = String(new Date().getMonth() + 1).padStart(2, '0')
      onChange({
        periodPreset: 'this_month',
        selectedYear: String(currentYearNum),
        selectedMonth: curMonthStr,
        dateFrom: '',
        dateTo: '',
      })
      setOpen(false)
      return
    }

    if (preset === 'last_month') {
      const lmDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
      const lmYear = String(lmDate.getFullYear())
      const lmMonth = String(lmDate.getMonth() + 1).padStart(2, '0')
      onChange({
        periodPreset: 'last_month',
        selectedYear: lmYear,
        selectedMonth: lmMonth,
        dateFrom: '',
        dateTo: '',
      })
      setOpen(false)
      return
    }

    if (preset === 'last_year') {
      onChange({
        periodPreset: 'last_year',
        selectedYear: String(currentYearNum - 1),
        selectedMonth: '',
        dateFrom: '',
        dateTo: '',
      })
      setOpen(false)
      return
    }

    if (preset === 'last_30' || preset === 'last_90') {
      onChange({
        periodPreset: preset,
        selectedYear: '',
        selectedMonth: '',
        dateFrom: '',
        dateTo: '',
      })
      setOpen(false)
      return
    }

    if (preset === 'custom') {
      onChange({
        ...values,
        periodPreset: 'custom',
      })
      return
    }
  }

  function handleReset(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(DEFAULT_EXCEL_DATE_FILTER)
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative inline-block w-full text-left font-normal ${className}`}>
      {/* Botão na Célula da Coluna */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full text-[11px] py-1 px-1.5 font-bold rounded flex items-center justify-between gap-1 border transition-all cursor-pointer ${
          hasActiveFilter
            ? 'bg-industrial-blue text-white border-industrial-blue shadow-xs'
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
        title="Filtro de Data estilo Excel (Períodos, Ano, Mês e Datas)"
      >
        <span className="truncate flex items-center gap-1">
          <CalendarDays className="h-3 w-3 shrink-0" />
          <span>{getButtonLabel()}</span>
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          {hasActiveFilter && (
            <span
              onClick={handleReset}
              className="p-0.5 rounded hover:bg-white/20 text-white cursor-pointer"
              title="Limpar filtro de data"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </div>
      </button>

      {/* Popover / Dropdown ao Clicar na Célula */}
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={popRef} style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? 0 }}
          className="w-72 max-h-[calc(100vh-16px)] overflow-y-auto text-left font-normal bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-3 shadow-2xl z-[300] text-xs space-y-3 normal-case tracking-normal">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200">
            <span className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-industrial-blue dark:text-sky-400" />
              Filtro de Data (Excel)
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[10px] text-red-600 dark:text-red-400 hover:underline font-bold"
              >
                Limpar Filtro
              </button>
            )}
          </div>

          {/* Presets Rápidos */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Período Rápido:
            </label>
            <Select sort={false}
              value={values.periodPreset || 'all'}
              onChange={(e) => updatePreset(e.target.value)}
              className="input !text-xs !py-1 !px-2 font-bold w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="all">📅 Todos os Períodos</option>
              <option value="this_year">🗓️ Este Ano ({currentYearNum})</option>
              <option value="this_month">📆 Este Mês</option>
              <option value="last_month">⏮️ Mês Anterior</option>
              <option value="last_year">📜 Ano Anterior ({currentYearNum - 1})</option>
              <option value="last_30">⏱️ Últimos 30 Dias</option>
              <option value="last_90">⏱️ Últimos 90 Dias</option>
              <option value="custom">✏️ Personalizado (Ano / Mês / Datas)</option>
            </Select>
          </div>

          {/* Seletores de Ano e Mês */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Ano:
              </label>
              <Select sort={false}
                value={values.selectedYear || ''}
                onChange={(e) =>
                  onChange({
                    ...values,
                    selectedYear: e.target.value,
                    periodPreset: 'custom',
                  })
                }
                className="input !text-xs !py-1 !px-2 font-bold w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">(Todos)</option>
                {yearsOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Mês:
              </label>
              <Select sort={false}
                value={values.selectedMonth || ''}
                onChange={(e) =>
                  onChange({
                    ...values,
                    selectedMonth: e.target.value,
                    periodPreset: 'custom',
                  })
                }
                className="input !text-xs !py-1 !px-2 font-bold w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="">(Todos)</option>
                {MONTH_NAMES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Intervalo de Datas De / Até */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Intervalo de Datas:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block">De:</span>
                <input
                  type="date"
                  value={values.dateFrom || ''}
                  onChange={(e) =>
                    onChange({ ...values, dateFrom: e.target.value, periodPreset: 'custom' })
                  }
                  className="input !text-xs !py-1 !px-1.5 font-mono w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block">Até:</span>
                <input
                  type="date"
                  value={values.dateTo || ''}
                  onChange={(e) =>
                    onChange({ ...values, dateTo: e.target.value, periodPreset: 'custom' })
                  }
                  className="input !text-xs !py-1 !px-1.5 font-mono w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-primary !py-1 !px-3 !text-xs"
            >
              Aplicar
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export default function ExcelDateFilter(props: any) {
  return <ExcelColumnDateFilter {...props} />
}
