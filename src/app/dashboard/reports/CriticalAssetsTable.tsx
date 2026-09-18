'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTableSort, SortableTh } from '@/lib/useTableSort'

export type CriticalAssetRow = {
  id: string
  area: string | null
  tag: string | null
  name: string
  active: boolean
  criticidadeABC: 'A' | 'B' | 'C' | string
  totalTasks: number
  openUrgent: number
}

const ABC_RANK: Record<string, number> = { A: 1, B: 2, C: 3 }

export default function CriticalAssetsTable({ rows }: { rows: CriticalAssetRow[] }) {
  const router = useRouter()
  const [colF, setColF] = useState({ area: '', tag: '', name: '', crit: '', estado: '' })
  const setCol = (k: keyof typeof colF, v: string) => setColF((c) => ({ ...c, [k]: v }))
  const anyFilter = Object.values(colF).some(Boolean)
  const norm = (s: string | null | undefined) => String(s ?? '').toLowerCase().trim()
  const inc = (val: string | null | undefined, f: string) => !f || norm(val).includes(norm(f))

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!inc(r.area, colF.area)) return false
      if (!inc(r.tag, colF.tag)) return false
      if (!inc(r.name, colF.name)) return false
      if (colF.crit && r.criticidadeABC !== colF.crit) return false
      if (colF.estado === 'ativo' && !r.active) return false
      if (colF.estado === 'inativo' && r.active) return false
      return true
    })
  }, [rows, colF])

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort<CriticalAssetRow>(
    filtered,
    {
      area: (r) => r.area,
      tag: (r) => r.tag,
      name: (r) => r.name,
      crit: (r) => ABC_RANK[r.criticidadeABC] ?? 4,
      total: (r) => r.totalTasks,
      urgent: (r) => r.openUrgent,
      estado: (r) => (r.active ? 0 : 1),
    },
    'crit',
  )

  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  useEffect(() => { setCurrentPage(1) }, [colF, pageSize])

  const totalPages = Math.ceil(sorted.length / pageSize) || 1
  const shown = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const colFilterCls = 'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-safety-orange shadow-sm'

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 no-print flex-wrap">
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {sorted.length} / {rows.length}
          {anyFilter && (
            <button onClick={() => setColF({ area: '', tag: '', name: '', crit: '', estado: '' })} className="ml-2 text-red-600 hover:underline font-bold">
              Limpar filtros
            </button>
          )}
        </p>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
          <span>Por página:</span>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="input text-xs py-1 px-2 w-auto">
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[650px] md:min-w-0">
          <thead>
            <tr className="bg-slate-100/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
              <SortableTh label="Área" sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="TAG" sortableKey="tag" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Equipamento" sortableKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Criticidade ABC" sortableKey="crit" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
              <SortableTh label="Total OTs" sortableKey="total" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
              <SortableTh label="Urgentes em Aberto" sortableKey="urgent" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
              <SortableTh label="Estado" sortableKey="estado" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50 no-print">
              <th className="px-1 py-1"><input value={colF.area} onChange={(e) => setCol('area', e.target.value)} placeholder="filtrar…" className={colFilterCls} /></th>
              <th className="px-1 py-1"><input value={colF.tag} onChange={(e) => setCol('tag', e.target.value)} placeholder="filtrar…" className={colFilterCls} /></th>
              <th className="px-1 py-1"><input value={colF.name} onChange={(e) => setCol('name', e.target.value)} placeholder="filtrar…" className={colFilterCls} /></th>
              <th className="px-1 py-1">
                <select value={colF.crit} onChange={(e) => setCol('crit', e.target.value)} className={colFilterCls}>
                  <option value="">Todas</option>
                  <option value="A">Classe A</option>
                  <option value="B">Classe B</option>
                  <option value="C">Classe C</option>
                </select>
              </th>
              <th className="px-1 py-1" />
              <th className="px-1 py-1" />
              <th className="px-1 py-1">
                <select value={colF.estado} onChange={(e) => setCol('estado', e.target.value)} className={colFilterCls}>
                  <option value="">Todos</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-400 dark:text-slate-500">
                  Sem equipamentos correspondentes aos filtros.
                </td>
              </tr>
            ) : shown.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(`/dashboard/assets/${r.id}`)}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                title="Clique para abrir a ficha e o histórico deste equipamento"
              >
                <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{r.area || '—'}</td>
                <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">{r.tag || '—'}</span>
                </td>
                <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">{r.name}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-extrabold ${
                    r.criticidadeABC === 'A' ? 'bg-red-100 text-red-800 border border-red-300' :
                    r.criticidadeABC === 'B' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                    'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    Classe {r.criticidadeABC}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center font-bold font-mono text-slate-800 dark:text-slate-200">
                  <Link
                    href={`/dashboard/tasks?search=${encodeURIComponent(r.tag || r.name)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    {r.totalTasks} OT(s) ↗
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-center font-mono">
                  {r.openUrgent > 0 ? (
                    <Link
                      href={`/dashboard/tasks?search=${encodeURIComponent(r.tag || r.name)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-red-50 text-red-700 font-extrabold px-2 py-0.5 rounded border border-red-200 hover:bg-red-100 transition-colors"
                    >
                      ⚠️ {r.openUrgent}
                    </Link>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${r.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-300'}`}>
                    {r.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-slate-800 no-print">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {Math.min((currentPage - 1) * pageSize + 1, sorted.length)}-{Math.min(currentPage * pageSize, sorted.length)} de {sorted.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-40">
              Anterior
            </button>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-40">
              Seguinte
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
