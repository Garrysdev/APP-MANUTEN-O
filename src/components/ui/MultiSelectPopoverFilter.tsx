'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, X, Check } from 'lucide-react'

export interface FilterOption {
  value: string
  label: string
}

export default function MultiSelectPopoverFilter({
  label,
  options,
  selectedValues,
  onChange,
  placeholder,
  className = '',
  width = 'w-60',
}: {
  label: string
  options: FilterOption[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const count = selectedValues.length

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Limpar campo de busca quando abre o menu
  useEffect(() => {
    if (open) {
      setSearch('')
    }
  }, [open])

  // Ordenação alfanumérica natural das opções
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
    )
  }, [options])

  // Opções filtradas pela caixa de texto no topo
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedOptions
    return sortedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q)
    )
  }, [sortedOptions, search])

  function toggle(val: string) {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val))
    } else {
      onChange([...selectedValues, val])
    }
  }

  function clear() {
    onChange([])
  }

  function selectAllFiltered() {
    const visibleValues = filteredOptions.map((o) => o.value)
    const newSelected = Array.from(new Set([...selectedValues, ...visibleValues]))
    onChange(newSelected)
  }

  const displayText =
    count === 0
      ? placeholder || `${label} (Todas)`
      : count === 1
      ? `${label}: ${options.find((o) => o.value === selectedValues[0])?.label ?? selectedValues[0]}`
      : `${label} (${count})`

  return (
    <div ref={containerRef} className={`relative inline-block w-full max-w-full text-left ${className}`}>
      {/* Botão de Disparo do Filtro */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full max-w-full !text-[10px] sm:!text-[11px] !py-0.5 sm:!py-1 !px-1.5 font-extrabold rounded-md flex items-center justify-between gap-1 cursor-pointer shadow-xs transition-all border ${
          count > 0
            ? 'bg-industrial-blue text-white border-industrial-blue'
            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
        title={displayText}
      >
        <span className="truncate min-w-0 flex-1 text-left">{displayText}</span>
        <span className="text-[8px] opacity-70 shrink-0">▼</span>
      </button>

      {/* Popover / Menu Suspenso de Filtro */}
      {open && (
        <div
          className={`absolute top-full left-0 z-[100] mt-1 ${width} min-w-[200px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2.5 space-y-2 text-xs animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* Cabeçalho do Popover */}
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800 px-1">
            <span className="font-extrabold text-[11px] text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Filtro: {label}
            </span>
            <div className="flex items-center gap-2">
              {count > 0 ? (
                <button
                  type="button"
                  onClick={clear}
                  className="text-[10px] text-red-500 font-bold hover:underline cursor-pointer"
                >
                  Limpar ({count})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-[10px] text-industrial-blue dark:text-blue-400 font-bold hover:underline cursor-pointer"
                >
                  Selecionar Todos
                </button>
              )}
            </div>
          </div>

          {/* Caixa de Texto no Topo para Filtrar Opções Apresentadas */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Filtrar opções de ${label}...`}
              className="input !text-[11px] !py-1 !pl-7 !pr-6 w-full font-medium rounded-lg border-slate-300 dark:border-slate-700 focus:border-industrial-blue"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Lista de Opções com Checkboxes */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 py-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-3 px-2 text-center font-medium">
                Nenhuma opção corresponde a &quot;{search}&quot;
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selectedValues.includes(opt.value)
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer text-[11px] font-semibold transition-colors ${
                      checked
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-industrial-blue dark:text-blue-300 font-bold'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      className="rounded text-industrial-blue focus:ring-industrial-blue h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="truncate min-w-0 flex-1">{opt.label}</span>
                  </label>
                )
              })
            )}
          </div>

          {/* Rodapé com Contador e Botão Aplicar */}
          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center px-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
              {count} de {options.length} selecionados
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1 bg-industrial-blue hover:bg-industrial-blue/90 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              <span>Aplicar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
