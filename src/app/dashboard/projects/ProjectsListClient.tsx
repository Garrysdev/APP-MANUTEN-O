'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, FolderKanban, Play, CheckCircle2, ShieldAlert, Building2,
  BarChart3, Clock,
} from 'lucide-react'
import { format3DigitId } from '../history/HistoryClient'
import {
  type Task,
  type TaskStatus,
  type UserRole,
  STATUS_LABELS,
  TIPO_LABELS,
  statusBadgeClass,
} from '@/types/models'
import { formatDate, formatDateTime } from '@/lib/utils'
import { TipoBadge } from '@/components/ui/TipoBadge'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import {
  createProjectTaskAction, updateProjectTaskAction, deleteProjectTaskAction, loadStockRefsAction, type StockMaterialRef,
} from './actions'
import CreateTaskModal from '@/components/modals/CreateTaskModal'
import { ExcelColumnDateFilter, ExcelDateFilterValues, DEFAULT_EXCEL_DATE_FILTER, filterByExcelDate } from '@/components/ui/ExcelDateFilter'

type Ref = { id: string; name: string; tag?: string | null; area?: string | null }
type UserRef = Ref & {
  abbreviation?: string | null
  avatarUrl?: string | null
  active?: boolean
  role?: string | null
  isExternal?: boolean
  externalCompanyId?: string | null
  externalCompanyName?: string | null
}

/**
 * Lista de Projetos, estilo da página de OTs (`tasks/TasksClient.tsx`): chips de estado,
 * filtros por coluna, pesquisa, cartões no telemóvel, tabela ordenável + paginação no
 * desktop. O Gantt combinado (Projetos + barras de PM) vive à parte em /dashboard/gantt,
 * ligado por um botão no cabeçalho — ver plano "Planos & Limites, Projetos/Gantt" (Fase 5).
 */
export default function ProjectsListClient({
  tasks,
  assets,
  users,
  role,
}: {
  tasks: Task[]
  assets: Ref[]
  users: UserRef[]
  plans?: unknown[]
  role: UserRole
  userId: string
}) {
  const router = useRouter()
  const [stockRefs, setStockRefs] = useState<StockMaterialRef[]>([])
  const [stockLoaded, setStockLoaded] = useState(false)
  const [stockLoading, setStockLoading] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')
  const [, startTransition] = useTransition()

  const isManager = role === 'manager'
  const statuses: TaskStatus[] = ['prazo', 'pending', 'in_progress', 'done']

  function openCreate() {
    setEditing(null)
    setCreating(true)
    if (!stockLoaded && !stockLoading) {
      setStockLoading(true)
      loadStockRefsAction().then((res) => {
        setStockRefs(res)
        setStockLoaded(true)
        setStockLoading(false)
      })
    }
  }

  function openEdit(task: Task) {
    setCreating(false)
    setEditing(task)
    if (!stockLoaded && !stockLoading) {
      setStockLoading(true)
      loadStockRefsAction().then((res) => {
        setStockRefs(res)
        setStockLoaded(true)
        setStockLoading(false)
      })
    }
  }

  function closeModal() {
    setCreating(false)
    setEditing(null)
  }

  const [taskList, setTaskList] = useState<Task[]>(tasks)
  useEffect(() => { setTaskList(tasks) }, [tasks])

  const [search, setSearch] = useState('')
  const [searchArea, setSearchArea] = useState('')
  const [searchTag, setSearchTag] = useState('')
  const [searchTech, setSearchTech] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedTech, setSelectedTech] = useState('')
  const [excelDateFilter, setExcelDateFilter] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [areaFilter, setAreaFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.abbreviation || u.name])), [users])
  const assetAreaMap = useMemo(() => new Map(assets.map((a) => [a.id, a.area || ''])), [assets])
  const assetTagMap = useMemo(() => new Map(assets.map((a) => [a.id, a.tag || ''])), [assets])
  const userName = (id?: string | null) => (id ? userMap.get(id) ?? id ?? '—' : '—')

  const uniqueAreas = useMemo(() => {
    const set = new Set<string>()
    taskList.forEach((t) => {
      const area = (t as any).area || (t.assetId ? assetAreaMap.get(t.assetId) : '') || ''
      if (area && area !== '—') set.add(area.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [taskList, assetAreaMap])

  const uniqueTags = useMemo(() => {
    const set = new Set<string>()
    taskList.forEach((t) => {
      const tArea = (t as any).area || (t.assetId ? assetAreaMap.get(t.assetId) : '') || ''
      if (areaFilter && tArea.trim().toLowerCase() !== areaFilter.trim().toLowerCase()) return
      const tag = (t as any).tag || (t.assetId ? assetTagMap.get(t.assetId) : '') || ''
      if (tag && tag !== '—') set.add(tag.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [taskList, areaFilter, assetAreaMap, assetTagMap])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, searchArea, searchTag, searchTech, filter, selectedTech, areaFilter, tagFilter, pageSize])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const qArea = searchArea.trim().toLowerCase()
    const qTag = searchTag.trim().toLowerCase()
    const qTech = searchTech.trim().toLowerCase()

    return taskList.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false
      if (selectedTech && t.assignedTo !== selectedTech) return false

      const aArea = ((t as any).area || (t.assetId ? assetAreaMap.get(t.assetId) : '') || '').trim().toLowerCase()
      const aTag = ((t as any).tag || (t.assetId ? assetTagMap.get(t.assetId) : '') || '').trim().toLowerCase()

      if (areaFilter && aArea !== areaFilter.trim().toLowerCase()) return false
      if (tagFilter && aTag !== tagFilter.trim().toLowerCase()) return false
      if (qArea && !aArea.includes(qArea)) return false
      if (qTag && !aTag.includes(qTag)) return false
      if (qTech) {
        const uName = (t.assignedTo ? userMap.get(t.assignedTo) || '' : '').toLowerCase()
        if (!uName.includes(qTech)) return false
      }
      if (!filterByExcelDate(t.dueDate || t.createdAt, excelDateFilter)) return false
      if (q) {
        const aSearch = t.assetId ? (assetMap.get(t.assetId) || '') : ''
        const text = `${t.title || ''} ${t.description || ''} ${(t as any).tag || ''} ${(t as any).area || ''} ${aSearch}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [taskList, filter, selectedTech, areaFilter, tagFilter, search, searchArea, searchTag, searchTech, assetAreaMap, assetTagMap, userMap, assetMap, excelDateFilter])

  const { sorted: shown, sortKey, sortDir, toggleSort } = useTableSort<Task>(
    filtered,
    {
      title: (t) => t.title?.toLowerCase(),
      tipo: (t) => TIPO_LABELS[t.tipo] ?? t.tipo,
      assignee: (t) => userName(t.assignedTo),
      status: (t) => STATUS_LABELS[t.status],
      dueDate: (t) => t.dueDate ?? null,
      plannedStartDate: (t) => t.plannedStartDate ?? t.createdAt ?? null,
      area: (t) => (t as any).area || (t.assetId ? assetAreaMap.get(t.assetId) : ''),
      tag: (t) => (t as any).tag || (t.assetId ? assetTagMap.get(t.assetId) : ''),
    },
    null,
  )

  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize))
  const currentShown = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return shown.slice(start, start + pageSize)
  }, [shown, currentPage, pageSize])

  const totalCount = filtered.length
  const completedCount = filtered.filter((t) => t.status === 'done').length
  const inProgressCount = filtered.filter((t) => t.status === 'in_progress').length
  const overdueCount = filtered.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length
  const allocatedTechsCount = useMemo(() => new Set(filtered.map((t) => t.assignedTo).filter(Boolean)).size, [filtered])

  const modalActive = creating || editing !== null

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-industrial-blue dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Projetos</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {filtered.length} / {taskList.length}
            </span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-industrial-blue-light dark:text-slate-400 mt-1">
            Lista de projetos e alocação de técnicos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/dashboard/gantt"
            className="h-10 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <BarChart3 size={16} className="shrink-0" />
            <span>Ver Gráficos Gantt</span>
          </Link>
          <button onClick={openCreate} className="shrink-0 h-10 px-4 bg-safety-orange hover:bg-safety-orange/90 text-white rounded-xl font-bold text-xs shadow-lg shadow-safety-orange/15 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
            <Plus size={16} className="stroke-[2.5] shrink-0" />
            <span className="hidden sm:inline">Novo Projeto</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Projetos</span>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{totalCount}</p>
          </div>
          <FolderKanban className="h-7 w-7 text-blue-600 opacity-80" />
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Em Progresso</span>
            <p className="text-xl font-extrabold text-teal-700 dark:text-teal-400">{inProgressCount}</p>
          </div>
          <Play className="h-7 w-7 text-teal-600 opacity-80" />
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Em Risco / Atrasados</span>
            <p className="text-xl font-extrabold text-red-700 dark:text-red-400">{overdueCount}</p>
          </div>
          <ShieldAlert className="h-7 w-7 text-red-600 opacity-80" />
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Concluídos</span>
            <p className="text-xl font-extrabold text-green-700 dark:text-green-400">{completedCount}</p>
          </div>
          <CheckCircle2 className="h-7 w-7 text-green-600 opacity-80" />
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Técnicos Alocados</span>
            <p className="text-xl font-extrabold text-purple-700 dark:text-purple-400">{allocatedTechsCount}</p>
          </div>
          <Building2 className="h-7 w-7 text-purple-600 opacity-80" />
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap items-center">
            {(['all', ...statuses] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                  filter === s ? 'bg-industrial-blue text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {s === 'all' ? 'Todos os Estados' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-36">
              <ExcelColumnDateFilter values={excelDateFilter} onChange={setExcelDateFilter} />
            </div>
            <select
              value={areaFilter}
              onChange={(e) => { setAreaFilter(e.target.value); setTagFilter('') }}
              className="input text-xs py-1.5 px-2.5 w-36 font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="">-- Área: Todas --</option>
              {uniqueAreas.map((area) => (
                <option key={area} value={area}>Área: {area}</option>
              ))}
            </select>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="input text-xs py-1.5 px-2.5 w-36 font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            >
              <option value="">-- TAG: Todas --</option>
              {uniqueTags.map((tag) => (
                <option key={tag} value={tag}>TAG: {tag}</option>
              ))}
            </select>
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="input text-xs py-1.5 px-3 w-44 font-bold"
            >
              <option value="">-- Todos os Técnicos --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>👤 {u.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar Projeto, TAG..."
              className="input text-xs py-1.5 px-3 w-40 sm:w-48"
            />
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="input text-xs py-1.5 px-2.5 font-bold"
            >
              {[20, 50, 100].map((n) => <option key={n} value={n}>{n} / pág.</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Cartões — telemóvel e tablet */}
      <div className="md:hidden space-y-2.5">
        {currentShown.length === 0 ? (
          <div className="card p-8 text-center text-slate-400">
            <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Sem projetos neste filtro.</p>
          </div>
        ) : (
          currentShown.map((t, idx) => {
            const asset = assets.find((a) => a.id === t.assetId)
            const formattedId = format3DigitId(t.id, idx)
            const tag = (asset as any)?.tag || asset?.name || (t as any).tag || '—'
            const area = (t as any).area || (asset as any)?.area || '—'
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => openEdit(t)}
                className="card w-full text-left border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 active:bg-blue-50/70 dark:active:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">{formattedId}</span>
                    <TipoBadge tipo={t.tipo} codeOnly={true} />
                    <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 truncate">{tag} · {area}</span>
                  </div>
                  <span className={`${statusBadgeClass(t.status)} shrink-0`}>{STATUS_LABELS[t.status]}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{t.title}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{userName(t.assignedTo)}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    <Clock className="h-3 w-3 text-industrial-blue dark:text-sky-400" />
                    <span>{formatDate(t.plannedStartDate || t.createdAt)}</span>
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Tabela — desktop */}
      <div className="hidden md:block card overflow-hidden">
        {shown.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400">
            <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Sem projetos neste filtro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                  <SortableTh label="ID" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="DATA" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="ÁREA" sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="EQUIPAMENTO / TAG" sortableKey="tag" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="TI" sortableKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="PROJETO / DESCRIÇÃO" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="TÉCNICOS" sortableKey="assignee" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="INÍCIO" sortableKey="plannedStartDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
                  <SortableTh label="FIM" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
                  <SortableTh label="ESTADO" sortableKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {currentShown.map((t, idx) => {
                  const asset = assets.find((a) => a.id === t.assetId)
                  const formattedId = format3DigitId(t.id, idx)
                  const sDateStr = t.plannedStartDate ? t.plannedStartDate.slice(0, 10) : (t.createdAt ? t.createdAt.slice(0, 10) : '')
                  const eDateStr = t.dueDate ? t.dueDate.slice(0, 10) : sDateStr
                  return (
                    <tr
                      key={t.id}
                      onClick={() => openEdit(t)}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/70 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                      title="Clique para abrir e editar o projeto"
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <span className="bg-slate-100/90 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 group-hover:border-blue-400 group-hover:bg-blue-100/80 transition-colors">{formattedId}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-800 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(sDateStr || t.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {(t as any).area || (asset as any)?.area || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const tagOrName = (asset as any)?.tag || asset?.name || (t as any).tag || '—'
                          const targetId = asset?.id || t.assetId || (t as any).tag
                          if (!targetId || tagOrName === '—') return <span>{tagOrName}</span>
                          return (
                            <Link
                              href={`/dashboard/assets/${encodeURIComponent(targetId)}`}
                              className="text-industrial-blue dark:text-blue-400 hover:text-safety-orange hover:underline font-bold transition-colors"
                              title={`Abrir página do equipamento ${tagOrName}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {tagOrName}
                            </Link>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <TipoBadge tipo={t.tipo} codeOnly={true} />
                      </td>
                      <td className="px-3 py-2.5 text-slate-900 dark:text-slate-100 font-semibold max-w-[280px]">
                        <span className="hover:text-safety-orange transition-colors underline-offset-2 group-hover:underline">{t.title}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-800 dark:text-slate-300 font-semibold whitespace-nowrap">
                        {userName(t.assignedTo)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300 hidden xl:table-cell whitespace-nowrap">
                        {sDateStr ? formatDate(sDateStr) : formatDateTime(t.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300 hidden xl:table-cell whitespace-nowrap">
                        {eDateStr ? formatDate(eDateStr) : (t.updatedAt ? formatDateTime(t.updatedAt) : '—')}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={statusBadgeClass(t.status)}>{STATUS_LABELS[t.status]}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 px-4 py-3 bg-gray-50/50 dark:bg-slate-900/50">
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Página {currentPage} de {totalPages} ({shown.length} projetos)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-40"
              >
                Seguinte
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateTaskModal
        isOpen={modalActive}
        onClose={closeModal}
        editingTask={editing}
        assets={assets}
        users={users}
        stockRefs={stockRefs}
        isManager={isManager}
        createAction={createProjectTaskAction}
        updateAction={updateProjectTaskAction}
        deleteAction={deleteProjectTaskAction}
        availableTasksForDependencies={taskList}
        showDependencies={true}
        onSuccess={() => {
          closeModal()
          router.refresh()
        }}
      />
    </div>
  )
}
