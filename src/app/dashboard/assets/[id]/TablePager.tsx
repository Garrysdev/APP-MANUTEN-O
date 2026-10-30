'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Select from '@/components/ui/Select'

/** Rodapé das tabelas da ficha do equipamento: linhas por página (20/50/100) e páginas. */
export default function TablePager({ total, page, pageSize, onPage, onPageSize }: {
  total: number
  page: number
  pageSize: number
  onPage: (p: number) => void
  onPageSize: (n: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs text-gray-600 dark:text-slate-300">
      <div className="flex items-center gap-2">
        <span>Linhas por página:</span>
        <Select sort={false} value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="input text-xs py-1 px-2 w-auto">
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <span>{total === 0 ? '0' : `${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, total)}`} de {total}</span>
        <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30" aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30" aria-label="Página seguinte">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
