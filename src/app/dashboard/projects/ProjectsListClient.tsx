'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, FolderKanban, BarChart3, Clock, X } from 'lucide-react'
import { format3DigitId } from '../history/HistoryClient'
import {
  type Task,
  type TaskStatus,
  type UserRole,
  STATUS_LABELS,
  TIPO_LABELS,
  statusBadgeClass,
} from '@/types/models'
import { formatDate } from '@/lib/utils'
import { TipoBadge } from '@/components/ui/TipoBadge'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import {
  createProjectTaskAction, updateProjectTaskAction, deleteProjectTaskAction, loadStockRefsAction, type StockMaterialRef,
} from './actions'
import CreateTaskModal from '@/components/modals/CreateTaskModal'
import { ExcelColumnDateFilter, ExcelDateFilterValues, DEFAULT_EXCEL_DATE_FILTER, filterByExcelDate } from '@/components/ui/ExcelDateFilter'
import MultiSelectPopoverFilter from '@/components/ui/MultiSelectPopoverFilter'
import Select from '@/components/ui/Select'
import { matchesTechFilter } from '@/lib/task-assignment'
import { useProjectStatusFilter, ProjectKpiCards, ProjectStatusChips, PROJECT_STATUSES } from './ProjectStatusFilter'

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

const day = (v?: string | null) => (v ? v.slice(0, 10) : '')
// Datas das colunas: DATA = lançamento, INÍCIO/FIM = reais, DATA LIMITE = prazo (fim da barra no Gantt).
const startOf = (t: Task) => day(t.startedAt || t.plannedStartDate)
const emptyCol = { id: '', ti: '', projeto: '' }

/**
 * Lista de Projetos, estilo da página de OTs (`tasks/TasksClient.tsx`): chips de estado que
 * se somam (abre só com os ativos), cartões que filtram, linha de filtros por coluna sempre
 * visível, cartões no telemóvel, tabela ordenável + paginação no desktop. O Gantt vive à
 * parte em /dashboard/gantt, ligado por um botão no cabeçalho.
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
  const statusCtl = useProjectStatusFilter()

  const isManager = role === 'manager'

  function loadStock() {
    if (!stockLoaded && !stockLoading) {
      setStockLoading(true)
      loadStockRefsAction().then((res) => {
        setStockRefs(res)
        setStockLoaded(true)
        setStockLoading(false)
      })
    }
  }

  function openCreate() {
    setEditing(null)
    setCreating(true)
    loadStock()
  }

  function openEdit(task: Task) {
    setCreating(false)
    setEditing(task)
    loadStock()
  }

  function closeModal() {
    setCreating(false)
    setEditing(null)
  }

  const [taskList, setTaskList] = useState<Task[]>(tasks)
  useEffect(() => { setTaskList(tasks) }, [tasks])

  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [colF, setColF] = useState(emptyCol)
  const setCol = (k: keyof typeof emptyCol, v: string) => setColF((c) => ({ ...c, [k]: v }))
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTechs, setSelectedTechs] = useState<string[]>([])
  const [dataF, setDataF] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [inicioF, setInicioF] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [fimF, setFimF] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [limiteF, setLimiteF] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)

  function clearFilters() {
    setColF(emptyCol)
    setSelectedAreas([])
    setSelectedTags([])
    setSelectedTechs([])
    setDataF(DEFAULT_EXCEL_DATE_FILTER)
    setInicioF(DEFAULT_EXCEL_DATE_FILTER)
    setFimF(DEFAULT_EXCEL_DATE_FILTER)
    setLimiteF(DEFAULT_EXCEL_DATE_FILTER)
    setSearch('')
  }

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.abbreviation || u.name])), [users])
  const userName = (id?: string | null) => (id ? userMap.get(id) ?? id ?? '—' : '—')
  const areaOf = (t: Task) => ((t as any).area || (t.assetId ? assetById.get(t.assetId)?.area : '') || '').trim()
  const tagOf = (t: Task) => ((t as any).tag || (t.assetId ? assetById.get(t.assetId)?.tag : '') || '').trim()

  const uniqueAreas = useMemo(() => [...new Set(taskList.map(areaOf).filter((a) => a && a !== '—'))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [taskList, assetById])
  const uniqueTags = useMemo(() => [...new Set(taskList.map(tagOf).filter((a) => a && a !== '—'))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [taskList, assetById])
  const techOptions = useMemo(() => users.map((u) => ({ value: u.id, label: u.abbreviation ? `${u.abbreviation} - ${u.name}` : u.name })), [users])

  // Todos os filtros menos o estado — é sobre isto que os cartões contam.
  const base = useMemo(() => {
    const q = search.trim().toLowerCase()
    const has = (v: unknown, f: string) => !f || String(v ?? '').toLowerCase().includes(f.trim().toLowerCase())
    return taskList.filter((t, idx) => {
      if (selectedAreas.length && !selectedAreas.includes(areaOf(t))) return false
      if (selectedTags.length && !selectedTags.includes(tagOf(t))) return false
      if (selectedTechs.length && !selectedTechs.some((id) => matchesTechFilter(t, id, users))) return false
      if (!has(format3DigitId(t.id, idx, t.otNumber), colF.id)) return false
      if (!has(`${TIPO_LABELS[t.tipo] ?? t.tipo} ${t.tipo}`, colF.ti)) return false
      if (!has(`${t.title || ''} ${t.description || ''}`, colF.projeto)) return false
      if (!filterByExcelDate(t.createdAt, dataF)) return false
      if (!filterByExcelDate(startOf(t) || null, inicioF)) return false
      if (!filterByExcelDate(t.completedAt || null, fimF)) return false
      if (!filterByExcelDate(t.dueDate || null, limiteF)) return false
      if (q) {
        const text = `${t.title || ''} ${t.description || ''} ${tagOf(t)} ${areaOf(t)} ${t.assetId ? assetById.get(t.assetId)?.name || '' : ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [taskList, selectedAreas, selectedTags, selectedTechs, colF, dataF, inicioF, fimF, limiteF, search, users, assetById])

  const filtered = useMemo(() => base.filter(statusCtl.matches), [base, statusCtl.matches])

  useEffect(() => { setCurrentPage(1) }, [base, statusCtl.statuses, statusCtl.card, pageSize])

  const { sorted: shown, sortKey, sortDir, toggleSort } = useTableSort<Task>(
    filtered,
    {
      id: (t) => t.otNumber ?? t.id,
      data: (t) => t.createdAt ?? null,
      title: (t) => t.title?.toLowerCase(),
      tipo: (t) => TIPO_LABELS[t.tipo] ?? t.tipo,
      assignee: (t) => userName(t.assignedTo),
      status: (t) => STATUS_LABELS[t.status],
      inicio: (t) => startOf(t) || null,
      fim: (t) => t.completedAt ?? null,
      dueDate: (t) => t.dueDate ?? null,
      area: (t) => areaOf(t),
      tag: (t) => tagOf(t),
    },
    null,
  )

  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize))
  const currentShown = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return shown.slice(start, start + pageSize)
  }, [shown, currentPage, pageSize])

  const modalActive = creating || editing !== null
  const fInput = 'input !text-[11px] !py-0.5 !px-1.5 w-full font-semibold'

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

      <ProjectKpiCards base={base} ctl={statusCtl} />

      <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <ProjectStatusChips ctl={statusCtl} />
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar Projeto, TAG..."
            className="input text-xs py-1.5 px-3 w-40 sm:w-48"
          />
          <Select sort={false}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="input text-xs py-1.5 px-2.5 font-bold"
          >
            {[20, 50, 100].map((n) => <option key={n} value={n}>{n} / pág.</option>)}
          </Select>
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
            const asset = t.assetId ? assetById.get(t.assetId) : undefined
            const formattedId = format3DigitId(t.id, idx, t.otNumber)
            const tag = asset?.tag || asset?.name || (t as any).tag || '—'
            const area = areaOf(t) || '—'
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
                    <span>{t.dueDate ? `Limite ${formatDate(t.dueDate)}` : formatDate(startOf(t) || t.createdAt)}</span>
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Tabela — desktop (cabeçalhos e linha de filtros sempre visíveis, mesmo sem resultados) */}
      <div className="hidden md:block card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                <SortableTh label="ID" sortableKey="id" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="DATA" sortableKey="data" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="ÁREA" sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="EQUIPAMENTO / TAG" sortableKey="tag" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="TI" sortableKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="PROJETO / DESCRIÇÃO" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="TÉCNICOS" sortableKey="assignee" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="INÍCIO" sortableKey="inicio" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="FIM" sortableKey="fim" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="DATA LIMITE" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="ESTADO" sortableKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
              {/* Linha de filtro por coluna (sempre visível, como nas OT / PM) */}
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200">
                <td className="p-1"><input value={colF.id} onChange={(e) => setCol('id', e.target.value)} placeholder="000..." className={fInput} /></td>
                <td className="p-1"><ExcelColumnDateFilter values={dataF} onChange={setDataF} /></td>
                <td className="p-1">
                  <MultiSelectPopoverFilter label="Área" options={uniqueAreas.map((a) => ({ value: a, label: a }))} selectedValues={selectedAreas} onChange={setSelectedAreas} placeholder="Área (Todas)" width="w-56" />
                </td>
                <td className="p-1">
                  <MultiSelectPopoverFilter label="TAG" options={uniqueTags.map((a) => ({ value: a, label: a }))} selectedValues={selectedTags} onChange={setSelectedTags} placeholder="TAG (Todas)" width="w-64" />
                </td>
                <td className="p-1"><input value={colF.ti} onChange={(e) => setCol('ti', e.target.value)} placeholder="TI..." className={fInput} /></td>
                <td className="p-1"><input value={colF.projeto} onChange={(e) => setCol('projeto', e.target.value)} placeholder="Projeto..." className={fInput} /></td>
                <td className="p-1">
                  <MultiSelectPopoverFilter label="Técnico" options={techOptions} selectedValues={selectedTechs} onChange={setSelectedTechs} placeholder="Técnico (Todos)" width="w-56" />
                </td>
                <td className="p-1"><ExcelColumnDateFilter values={inicioF} onChange={setInicioF} /></td>
                <td className="p-1"><ExcelColumnDateFilter values={fimF} onChange={setFimF} /></td>
                <td className="p-1"><ExcelColumnDateFilter values={limiteF} onChange={setLimiteF} /></td>
                <td className="p-1">
                  <MultiSelectPopoverFilter
                    label="Estado"
                    options={PROJECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                    selectedValues={statusCtl.statuses}
                    onChange={(vals) => statusCtl.setStatuses(vals.length ? (vals as TaskStatus[]) : PROJECT_STATUSES)}
                    placeholder="Estado (Todos)"
                    width="w-48"
                  />
                </td>
              </tr>
            </thead>
            <tbody>
              {currentShown.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-gray-400">
                    <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Sem projetos neste filtro.</p>
                    <button type="button" onClick={clearFilters} className="mt-3 text-xs font-bold text-[#2E86C1] hover:underline inline-flex items-center gap-1 cursor-pointer">
                      <X size={14} /> Limpar Todos os Filtros
                    </button>
                  </td>
                </tr>
              )}
              {currentShown.map((t, idx) => {
                const asset = t.assetId ? assetById.get(t.assetId) : undefined
                const formattedId = format3DigitId(t.id, idx, t.otNumber)
                const dateCell = (v?: string | null) => (
                  <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{v ? formatDate(v) : '—'}</td>
                )
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
                      {formatDate(day(t.createdAt))}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {areaOf(t) || '—'}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const tagOrName = asset?.tag || asset?.name || (t as any).tag || '—'
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
                    {dateCell(startOf(t))}
                    {dateCell(day(t.completedAt))}
                    {dateCell(day(t.dueDate))}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={statusBadgeClass(t.status)}>{STATUS_LABELS[t.status]}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

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
        isProjectForm={true}
        onSuccess={() => {
          closeModal()
          router.refresh()
        }}
      />
    </div>
  )
}
