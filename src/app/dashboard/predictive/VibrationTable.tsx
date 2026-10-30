'use client'

import { useMemo, useState } from 'react'
import { Download, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import Select from '@/components/ui/Select'
import { metricLabel, type VibDayPayload, type VibSeriesMeta } from '@/lib/vibration'
import { windowRows, rowsCsv, formatStamp, type TimeWindow, type WindowRow } from '@/lib/vibration-window'

const RESOLUTIONS = [
  { group: 1, label: '10 min' },
  { group: 6, label: '1 hora' },
  { group: 144, label: '1 dia' },
]
const PAGE = 100

type Col = 't' | 'sensor' | 'metric' | 'min' | 'avg' | 'max'

/** Filtro numérico: "5", ">5", ">=5", "<5", "<=5" ou "3-5" (aceita vírgula decimal). */
export function matchNumber(filter: string, v: number | null): boolean {
  const f = filter.trim().replace(/,/g, '.').replace(/\s+/g, '')
  if (!f) return true
  if (v === null) return false
  const op = f.match(/^(>=|<=|>|<|=)?(-?\d+(?:\.\d+)?)$/)
  if (op) {
    const n = Number(op[2])
    switch (op[1]) {
      case '>': return v > n
      case '>=': return v >= n
      case '<': return v < n
      case '<=': return v <= n
      default: return String(v).startsWith(op[2]) || v === n
    }
  }
  const range = f.match(/^(-?\d+(?:\.\d+)?)(?:-|\.\.)(-?\d+(?:\.\d+)?)$/)
  if (range) return v >= Number(range[1]) && v <= Number(range[2])
  return true
}

export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const input = 'w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-1 text-[11px] font-normal normal-case'

export default function VibrationTable({ days, metas, window: win, sensorLabel, fileStem }: {
  days: VibDayPayload[]
  metas: VibSeriesMeta[]
  window: TimeWindow
  sensorLabel: (sensor: string) => string
  fileStem: string
}) {
  const spanDays = (win.to - win.from) / 86_400_000
  const [group, setGroup] = useState<number | null>(null)
  const g = group ?? (spanDays <= 3 ? 1 : spanDays <= 31 ? 6 : 144)
  const [f, setF] = useState<Record<Col, string>>({ t: '', sensor: '', metric: '', min: '', avg: '', max: '' })
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 't', dir: -1 })
  const [page, setPage] = useState(0)

  const metaOf = useMemo(() => { const m = new Map(metas.map((x) => [x.key, x])); return (k: string) => m.get(k) }, [metas])
  const sensors = useMemo(() => [...new Set(metas.map((m) => m.sensor))].sort(), [metas])
  const metrics = useMemo(() => [...new Set(metas.map((m) => m.metric))].sort(), [metas])

  const all = useMemo(() => windowRows(days, metas.map((m) => m.key), win, g), [days, metas, win, g])
  const rows = useMemo(() => {
    const txt = f.t.trim()
    const out = all.filter((r) => {
      const m = metaOf(r.key)
      if (f.sensor && m?.sensor !== f.sensor) return false
      if (f.metric && m?.metric !== f.metric) return false
      if (txt && !formatStamp(r.t).includes(txt) && !new Date(r.t).toLocaleString('pt-PT').includes(txt)) return false
      return matchNumber(f.min, r.min) && matchNumber(f.avg, r.avg) && matchNumber(f.max, r.max)
    })
    const val = (r: WindowRow): string | number => {
      const m = metaOf(r.key)
      if (sort.col === 'sensor') return m?.sensor ?? ''
      if (sort.col === 'metric') return m?.metric ?? ''
      if (sort.col === 't') return r.t
      return r[sort.col] ?? -Infinity
    }
    return [...out].sort((a, b) => {
      const x = val(a), y = val(b)
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt')
      return (c || a.t - b.t) * sort.dir
    })
  }, [all, f, sort, metaOf])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const p = Math.min(page, pages - 1)
  const setFilter = (col: Col, v: string) => { setF((prev) => ({ ...prev, [col]: v })); setPage(0) }
  const head = (col: Col, label: string, right = false) => (
    <th className={`py-1.5 px-2 cursor-pointer whitespace-nowrap ${right ? 'text-right' : ''}`}
      onClick={() => setSort((s) => ({ col, dir: s.col === col ? (s.dir === 1 ? -1 : 1) : 1 }))}>
      {label}{sort.col === col && (sort.dir === 1 ? <ArrowUp className="inline h-3 w-3 ml-0.5" /> : <ArrowDown className="inline h-3 w-3 ml-0.5" />)}
    </th>
  )
  const fmt = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-PT', { maximumFractionDigits: 3 }))

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mr-auto">Valores da janela ({rows.length.toLocaleString('pt-PT')} de {all.length.toLocaleString('pt-PT')} linhas)</h3>
        <label className="text-xs text-gray-600 dark:text-slate-300 flex items-center gap-2">Intervalo
          <Select value={String(g)} sort={false} onChange={(e) => { setGroup(Number(e.target.value)); setPage(0) }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs">
            {RESOLUTIONS.map((r) => <option key={r.group} value={r.group}>{r.label}</option>)}
          </Select>
        </label>
        <button type="button" disabled={rows.length === 0} onClick={() => downloadText(`${fileStem}-tabela.csv`, rowsCsv(rows, metaOf))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Exportar linhas filtradas
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left uppercase text-gray-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              {head('t', 'Data/hora')}{head('sensor', 'Sensor')}{head('metric', 'Grandeza')}
              {head('min', 'Mínimo', true)}{head('avg', 'Média', true)}{head('max', 'Máximo', true)}
            </tr>
            <tr className="align-top">
              <th className="px-1 py-1"><input className={input} placeholder="ex.: 2026-10-21 14:" value={f.t} onChange={(e) => setFilter('t', e.target.value)} /></th>
              <th className="px-1 py-1">
                <Select value={f.sensor} onChange={(e) => setFilter('sensor', e.target.value)} className={input}>
                  <option value="">Todos</option>
                  {sensors.map((s) => <option key={s} value={s}>{s === 'OUTROS' ? 'Motor' : sensorLabel(s)}</option>)}
                </Select>
              </th>
              <th className="px-1 py-1">
                <Select value={f.metric} onChange={(e) => setFilter('metric', e.target.value)} className={input}>
                  <option value="">Todas</option>
                  {metrics.map((m) => <option key={m} value={m}>{metricLabel(m)}</option>)}
                </Select>
              </th>
              {(['min', 'avg', 'max'] as const).map((c) => (
                <th key={c} className="px-1 py-1"><input className={`${input} text-right`} placeholder=">5 · <2 · 3-5" value={f[c]} onChange={(e) => setFilter(c, e.target.value)} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(p * PAGE, (p + 1) * PAGE).map((r) => {
              const m = metaOf(r.key)
              const u = m?.unit ? ` ${m.unit}` : ''
              return (
                <tr key={`${r.t}-${r.key}`} className="border-t border-slate-100 dark:border-slate-800 text-gray-700 dark:text-slate-200">
                  <td className="py-1 px-2 whitespace-nowrap font-mono">{formatStamp(r.t)}</td>
                  <td className="py-1 px-2 whitespace-nowrap">{m?.sensor === 'OUTROS' ? 'Motor' : sensorLabel(m?.sensor ?? '')}</td>
                  <td className="py-1 px-2 whitespace-nowrap">{m?.sensor === 'OUTROS' ? `${m.metric} ${m.label}` : metricLabel(m?.metric ?? r.key)}</td>
                  <td className="py-1 px-2 text-right whitespace-nowrap">{fmt(r.min)}{r.min !== null ? u : ''}</td>
                  <td className="py-1 px-2 text-right whitespace-nowrap font-semibold">{fmt(r.avg)}{r.avg !== null ? u : ''}</td>
                  <td className="py-1 px-2 text-right whitespace-nowrap">{fmt(r.max)}{r.max !== null ? u : ''}</td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-gray-500">Sem valores com estes filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-gray-600 dark:text-slate-300">
          <button type="button" disabled={p === 0} onClick={() => setPage(p - 1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          Página {p + 1} de {pages}
          <button type="button" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  )
}
