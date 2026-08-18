'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { History as HistoryIcon, X, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react'
import type { Intervention, Material, Task } from '@/types/models'
import { formatDate, formatDateTime } from '@/lib/utils'
import HistoryExportButtons from './HistoryExportButtons'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { useTableSort, SortableTh } from '@/lib/useTableSort'

type Ref = { id: string; name: string }
type UserRef = Ref & { avatarUrl?: string | null; abbreviation?: string | null; active?: boolean; role?: string | null }

export interface HistoryRow {
  id: string          // ID / Código com 3 dígitos (ex: 001, 002, 005)
  rawId: string
  data: string        // Data YYYY-MM-DD
  area: string        // Área ex: 80, 130INK
  equiTag: string     // Equipamento / TAG ex: 80 T5
  ti: string          // TI / Tipo ex: MI, MC, MP
  avaria: string      // Avaria / Descrição
  tecnicos: string    // Técnicos ex: LM, RG, Leandro M.
  inicio: string      // Início ex: DD/MM/YYYY HH:mm
  fim: string         // Fim ex: DD/MM/YYYY HH:mm
  causa: string       // Causa / Observações
  rawIntervention?: Intervention
  rawTask?: Task
}

const emptyCol = {
  id: '',
  data: '',
  area: '',
  equiTag: '',
  ti: '',
  avaria: '',
  tecnicos: '',
  inicio: '',
  fim: '',
  causa: ''
}

export function format3DigitId(rawId: string | number | undefined | null, index: number): string {
  if (!rawId) return String(index + 1).padStart(3, '0')
  const str = String(rawId).trim()
  const numMatch = str.match(/\d+$/)
  if (numMatch) {
    const num = parseInt(numMatch[0], 10)
    return String(num % 1000).padStart(3, '0')
  }
  return String(index + 1).padStart(3, '0')
}

const formatTiCode = (rawTipo?: string | null) => {
  if (!rawTipo) return 'MP'
  const lower = rawTipo.toLowerCase()
  if (lower === 'mc' || lower.includes('curat')) return 'MC'
  if (lower === 'mp' || lower.includes('prev')) return 'MP'
  if (lower === 'pm' || lower.includes('plan')) return 'PM'
  if (lower === 'ins' || lower.includes('insp')) return 'INS'
  if (lower === 'lub' || lower.includes('lubr')) return 'LUB'
  if (lower === 'cal' || lower.includes('calib')) return 'CAL'
  if (lower === 'out' || lower.includes('outr')) return 'OUT'
  return rawTipo.toUpperCase().slice(0, 4)
}

export default function HistoryClient({
  interventions,
  tasks,
  allMaterials,
  users,
  assets,
  userMap,
  assetMap,
  isTechnician,
}: {
  interventions: Intervention[]
  tasks: Task[]
  allMaterials: Material[]
  users: UserRef[]
  assets: Ref[]
  userMap: Record<string, string>
  assetMap: Record<string, string>
  isTechnician: boolean
}) {
  const { dict } = useLanguage()
  const [colF, setColF] = useState(emptyCol)
  const setCol = (k: keyof typeof emptyCol, v: string) => {
    setCurrentPage(1)
    setColF((c) => ({ ...c, [k]: v }))
  }
  function clearFilters() { setColF(emptyCol) }
  const anyFilter = Object.values(colF).some(Boolean)

  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const assetObjMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  // Resolução de nomes dos técnicos
  const resolveTechName = (techStr?: string | null) => {
    if (!techStr) return 'N/D'
    if (userMap[techStr]) return userMap[techStr]
    const u = users.find((usr) => usr.name.toLowerCase().includes(techStr.toLowerCase()) || usr.id === techStr)
    return u ? u.name : techStr
  }

  // Normalizar linhas de histórico (sem UI e STS, ID com 3 dígitos)
  const rows: HistoryRow[] = useMemo(() => {
    const existingTaskIds = new Set(interventions.map((i) => i.taskId))
    const list: HistoryRow[] = []
    let index = 0

    // 1. Intervenções ativas
    for (const iv of interventions) {
      const t = taskMap.get(iv.taskId)
      const asset = t?.assetId ? assetObjMap.get(t.assetId) : null
      const formattedId = format3DigitId(t?.id || iv.id, index++)
      list.push({
        id: formattedId,
        rawId: t?.id || iv.id,
        data: (iv.startedAt || iv.createdAt || '').slice(0, 10),
        area: (asset as any)?.area || (t as any)?.area || '—',
        equiTag: (asset as any)?.tag || asset?.name || (t as any)?.tag || '—',
        ti: formatTiCode(t?.tipo || 'MP'),
        avaria: t?.title || iv.observations || '—',
        tecnicos: resolveTechName(iv.technicianId || t?.assignedTo),
        inicio: formatDateTime(iv.startedAt || iv.createdAt),
        fim: formatDateTime(iv.endedAt || (iv as any).updatedAt || iv.createdAt),
        causa: iv.observations || t?.description || '—',
        rawIntervention: iv,
        rawTask: t
      })
    }

    // 2. OTs importadas da folha UR (source: folha_ur_historico) ou concluídas
    for (const t of tasks) {
      if ((t as any).source === 'folha_ur_historico' || t.status === 'done' || t.status === 'cancelled') {
        if (!existingTaskIds.has(t.id)) {
          const asset = t.assetId ? assetObjMap.get(t.assetId) : null
          const formattedId = format3DigitId(t.id, index++)
          list.push({
            id: formattedId,
            rawId: t.id,
            data: t.plannedStartDate ? formatDate(t.plannedStartDate) : (t.createdAt ? formatDate(t.createdAt) : '—'),
            area: (t as any).area || (asset as any)?.area || '—',
            equiTag: (asset as any)?.tag || (t as any).tag || asset?.name || '—',
            ti: formatTiCode((t as any).tipo || (t as any).ti || 'MC'),
            avaria: t.title || t.description || '—',
            tecnicos: resolveTechName(t.assignedTo) !== '—' ? resolveTechName(t.assignedTo) : ((t as any).assignedToText || '—'),
            inicio: t.plannedStartDate ? formatDate(t.plannedStartDate) : '—',
            fim: t.completedAt ? formatDate(t.completedAt) : '—',
            causa: t.description || '—',
            rawTask: t
          })
        }
      }
    }
    return list
  }, [interventions, tasks, taskMap, assetObjMap, userMap, users])

  const uniqueTechnicians = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach((u) => {
      if ((u as any).active !== false) {
        const isTech = (u as any).role === 'technician' || (u as any).role === 'tecnico' || (u as any).role === 'tech'
        if (isTech) {
          const val = u.abbreviation || u.name
          const label = u.abbreviation ? `${u.abbreviation} - ${u.name}` : u.name
          if (!map.has(val)) map.set(val, label)
        }
      }
    })
    rows.forEach((r) => {
      if (r.tecnicos && r.tecnicos !== '—' && r.tecnicos !== 'N/D') {
        const isDeleted = users.some((u) => (u as any).active === false && (u.abbreviation === r.tecnicos || u.name === r.tecnicos || u.id === r.tecnicos))
        if (!isDeleted && !map.has(r.tecnicos)) {
          map.set(r.tecnicos, r.tecnicos)
        }
      }
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt'))
  }, [users, rows])

  // Filtragem por coluna
  const norm = (s: string | null | undefined) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  const inc = (val: string | null | undefined, f: string) => !f || norm(val).includes(norm(f))

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!inc(r.id, colF.id)) return false
      if (!inc(r.data, colF.data)) return false
      if (!inc(r.area, colF.area)) return false
      if (!inc(r.equiTag, colF.equiTag)) return false
      if (!inc(r.ti, colF.ti)) return false
      if (!inc(r.avaria, colF.avaria)) return false
      if (!inc(r.tecnicos, colF.tecnicos)) return false
      if (!inc(r.inicio, colF.inicio)) return false
      if (!inc(r.fim, colF.fim)) return false
      if (!inc(r.causa, colF.causa)) return false
      return true
    })
  }, [rows, colF])

  // Ordenação
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort<HistoryRow>(
    filtered,
    {
      id: (r) => r.id,
      data: (r) => r.data,
      area: (r) => r.area,
      equiTag: (r) => r.equiTag,
      ti: (r) => r.ti,
      avaria: (r) => r.avaria,
      tecnicos: (r) => r.tecnicos,
      inicio: (r) => r.inicio,
      fim: (r) => r.fim,
      causa: (r) => r.causa,
    },
    'id',
    'asc'
  )

  const effectivePageSize = pageSize === -1 ? (sorted.length || 1) : pageSize
  const totalPages = Math.ceil(sorted.length / effectivePageSize) || 1
  const currentShown = useMemo(() => {
    if (pageSize === -1) return sorted
    return sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  }, [sorted, currentPage, pageSize])

  const colFilterCls = 'w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs font-bold text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-safety-orange focus:border-safety-orange shadow-sm'

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4 flex items-start justify-between gap-3 no-print">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">Histórico de Intervenções (UR)</h1>
          <p className="text-xs sm:text-sm text-slate-700 font-semibold mt-0.5">
            A mostrar {sorted.length} / {rows.length} registo(s)
          </p>
        </div>
        {!isTechnician && (
          <div className="flex items-center gap-2">
            <HistoryExportButtons
              interventions={interventions}
              tasks={tasks}
              allMaterials={allMaterials}
              userMap={userMap}
              assetMap={assetMap}
            />
          </div>
        )}
      </div>

      {/* Controlo de Linhas por página + Limpar Filtros */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          {anyFilter && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-600 font-bold hover:underline">
              <X className="h-3.5 w-3.5" /> Limpar filtros por coluna
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-900 font-bold">
          <span>Linhas por página:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
            className="input text-xs py-1 px-2 w-auto font-bold text-slate-900"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={-1}>Todos ({rows.length})</option>
          </select>
        </div>
      </div>

      {/* Tabela de Histórico (Sem UI e STS, ID com 3 dígitos) */}
      <div className="card overflow-x-auto">
        <table className="w-full text-xs min-w-[1100px] table-fixed">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider">
              <SortableTh label="ID" sortableKey="id" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[75px] px-2 py-2" />
              <SortableTh label="DATA" sortableKey="data" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[95px] px-2 py-2" />
              <SortableTh label="ÁREA" sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[80px] px-2 py-2" />
              <SortableTh label="EQUIPAMENTO / TAG" sortableKey="equiTag" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[140px] px-2 py-2" />
              <SortableTh label="TI" sortableKey="ti" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[70px] px-2 py-2" />
              <SortableTh label="AVARIA / DESCRIÇÃO" sortableKey="avaria" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[240px] px-2 py-2" />
              <SortableTh label="TÉCNICOS" sortableKey="tecnicos" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[130px] px-2 py-2" />
              <SortableTh label="INÍCIO" sortableKey="inicio" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[90px] px-2 py-2" />
              <SortableTh label="FIM" sortableKey="fim" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[90px] px-2 py-2" />
              <SortableTh label="CAUSA / OBS" sortableKey="causa" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[160px] px-2 py-2" />
              <th className="w-[90px] px-2 py-2 text-center text-xs font-bold">AÇÕES</th>
            </tr>
            {/* Linha de Filtros Estilo Excel */}
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-1.5 py-1">
                <input value={colF.id} onChange={(e) => setCol('id', e.target.value)} placeholder="000…" className={colFilterCls} />
              </th>
              <th className="px-1.5 py-1">
                <input value={colF.data} onChange={(e) => setCol('data', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
              </th>
              <th className="px-1.5 py-1">
                <select value={colF.area} onChange={(e) => setCol('area', e.target.value)} className={colFilterCls}>
                  <option value="">Área...</option>
                  {Array.from(new Set(rows.map((r) => r.area).filter(Boolean))).sort().map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </th>
              <th className="px-1.5 py-1">
                <select value={colF.equiTag} onChange={(e) => setCol('equiTag', e.target.value)} className={colFilterCls}>
                  <option value="">TAG...</option>
                  {Array.from(new Set(rows.map((r) => r.equiTag).filter(Boolean))).sort().map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </th>
              <th className="px-1.5 py-1">
                <select value={colF.ti} onChange={(e) => setCol('ti', e.target.value)} className={colFilterCls}>
                  <option value="">TI...</option>
                  <option value="MC">MC</option>
                  <option value="MP">MP</option>
                  <option value="PM">PM</option>
                  <option value="PI">PI</option>
                  <option value="MI">MI</option>
                  <option value="PR">PR</option>
                  <option value="INS">INS</option>
                  <option value="LUB">LUB</option>
                  <option value="CAL">CAL</option>
                  <option value="OUT">OUT</option>
                </select>
              </th>
              <th className="px-1.5 py-1">
                <input value={colF.avaria} onChange={(e) => setCol('avaria', e.target.value)} placeholder="Avaria…" className={colFilterCls} />
              </th>
              <th className="px-1.5 py-1">
                <select value={colF.tecnicos} onChange={(e) => setCol('tecnicos', e.target.value)} className={colFilterCls}>
                  <option value="">Técnico…</option>
                  {uniqueTechnicians.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </th>
              <th className="px-1.5 py-1">
                <input value={colF.inicio} onChange={(e) => setCol('inicio', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
              </th>
              <th className="px-1.5 py-1">
                <input value={colF.fim} onChange={(e) => setCol('fim', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
              </th>
              <th className="px-1.5 py-1">
                <input value={colF.causa} onChange={(e) => setCol('causa', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
              </th>
              <th className="px-1.5 py-1" />
            </tr>
          </thead>
          <tbody>
            {currentShown.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-12 text-center text-slate-400">
                  <HistoryIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">Nenhum registo de histórico encontrado com os filtros aplicados.</p>
                  {anyFilter && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-3 text-xs font-bold text-[#2E86C1] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <X size={14} /> Limpar Filtros das Colunas
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              currentShown.map((r) => (
                <tr key={r.rawId} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                    <Link href={`/dashboard/tasks/${r.rawId}`} className="bg-slate-100/90 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-slate-300 text-blue-800 hover:underline">
                      {r.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-800 font-semibold whitespace-nowrap">{r.data}</td>
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">{r.area}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">{r.equiTag}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                      {r.ti}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-900 font-semibold max-w-[280px]">
                    <Link href={`/dashboard/tasks/${r.rawId}`} className="hover:text-blue-600 hover:underline line-clamp-2" title={r.avaria}>
                      {r.avaria}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-800 font-semibold whitespace-nowrap">{r.tecnicos}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap">{r.inicio}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap">{r.fim}</td>
                  <td className="px-3 py-2.5 text-slate-700 max-w-[200px]">
                    <span className="line-clamp-2" title={r.causa}>{r.causa}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    <Link
                      href={`/dashboard/tasks/${r.rawId}`}
                      className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-blue-700 font-bold border border-slate-300 px-2 py-1 rounded text-[11px] shadow-sm transition-colors"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-blue-600" />
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Paginação */}
        {sorted.length > 0 && pageSize !== -1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-800 font-semibold">
            <span>
              Página {currentPage} de {totalPages} ({sorted.length} registos)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
