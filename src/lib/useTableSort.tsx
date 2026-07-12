'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export type SortDir = 'asc' | 'desc'

/**
 * Hook genérico de ordenação client-side para tabelas.
 * `accessor` mapeia uma chave de coluna ao valor comparável de cada linha.
 *
 * const { sorted, sortKey, sortDir, toggleSort } = useTableSort(items, accessors, 'title')
 */
export function useTableSort<T>(
  items: T[],
  accessors: Record<string, (row: T) => string | number | null | undefined>,
  initialKey: string | null = null,
  initialDir: SortDir = 'asc',
) {
  const [sortKey, setSortKey] = useState<string | null>(initialKey)
  const [sortDir, setSortDir] = useState<SortDir>(initialDir)

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !accessors[sortKey]) return items
    const acc = accessors[sortKey]
    const copy = [...items]
    copy.sort((a, b) => {
      const va = acc(a)
      const vb = acc(b)
      // nulos sempre no fim
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      let cmp: number
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb
      } else {
        cmp = String(va).localeCompare(String(vb), 'pt', { sensitivity: 'base', numeric: true })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [items, sortKey, sortDir, accessors])

  return { sorted, sortKey, sortDir, toggleSort }
}

/** Cabeçalho de coluna clicável com indicador de ordenação. */
export function SortableTh({
  label,
  sortableKey,
  sortKey,
  sortDir,
  onSort,
  className = '',
  align = 'left',
}: {
  label: string
  sortableKey: string
  sortKey: string | null
  sortDir: SortDir
  onSort: (key: string) => void
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  const active = sortKey === sortableKey
  const alignCls = align === 'right' ? 'justify-end text-right' : align === 'center' ? 'justify-center text-center' : 'text-left'
  return (
    <th className={`px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortableKey)}
        className={`flex items-center gap-1 w-full hover:text-gray-700 transition-colors ${alignCls}`}
        title="Ordenar por esta coluna"
      >
        <span>{label}</span>
        {active ? (
          sortDir === 'asc'
            ? <ChevronUp className="h-3.5 w-3.5 text-[#2E86C1]" />
            : <ChevronDown className="h-3.5 w-3.5 text-[#2E86C1]" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  )
}
