'use client'

import { useState, useEffect, useTransition, useId, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, FolderKanban, X, Play, CheckCircle2,
  ShieldAlert, Package, CalendarClock, Building2, Scale, Eye,
} from 'lucide-react'
import { format3DigitId } from '../history/HistoryClient'
import {
  type Task,
  type TaskStatus,
  type TaskCriticidade,
  type TipoTarefa,
  type UserRole,
  type Periodicidade,
  type Executor,
  STATUS_LABELS,
  CRITICIDADE_LABELS,
  TIPO_LABELS,
  PERIODICIDADE_LABELS,
} from '@/types/models'
import { formatDate, formatDateTime, taskDelayLevel, DELAY_CLASSES, DELAY_LABELS } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import {
  createProjectTaskAction, updateProjectTaskAction, deleteProjectTaskAction, updateProjectTaskStatusAction,
  loadPlanTaskRefsAction, loadStockRefsAction, type StockMaterialRef,
} from './actions'
import { createMaintenancePlanAction } from '../maintenance-plan/actions'

const PERIODICIDADE_OPTIONS: Periodicidade[] = ['semanal', 'mensal', 'trimestral', 'bianual', 'anual', 'bienal', 'trianual', 'horas', 'pontual']

type Ref = { id: string; name: string }
type UserRef = Ref & { avatarUrl?: string | null }
type PlanRef = {
  id: string
  title: string
  assetId: string
  criticidade: TaskCriticidade
  periodicidade: Periodicidade | null
  periodicidadeLabel: string | null
  executor: Executor | null
  legal: boolean
  months: string | null
  safetyRules: string[] | null
}

const CRITICIDADE_DOT: Record<TaskCriticidade, string> = {
  vermelho: 'bg-red-500',
  amarelo: 'bg-yellow-400',
  verde: 'bg-green-500',
}

const CRITICIDADE_BADGE: Record<TaskCriticidade, string> = {
  vermelho: 'bg-red-50 text-red-700 border border-red-200',
  amarelo: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  verde: 'bg-green-50 text-green-700 border border-green-200',
}

export const PREDEFINED_SAFETY_RULES = [
  'EPI: Capacete',
  'EPI: Luvas de proteção',
  'EPI: Óculos de proteção',
  'EPI: Botas de segurança',
  'EPI: Arnês de segurança',
  'EPI: Colete refletor',
  'EPI: Proteção auricular',
  'Verificar ausência de tensão',
  'Trabalho a quente - ter extintor próximo',
  'Manter área limpa e livre de obstáculos'
]

function DynamicList({
  label,
  icon: Icon,
  items,
  onChange,
  placeholder,
  addLabel,
  suggestions,
}: {
  label: string
  icon: React.ElementType
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  addLabel: string
  suggestions?: string[]
}) {
  const datalistId = useId()
  function update(i: number, val: string) {
    onChange(items.map((v, idx) => idx === i ? val : v))
  }
  function remove(i: number) {
    const next = items.filter((_, idx) => idx !== i)
    onChange(next.length ? next : [''])
  }
  function add() { onChange([...items, '']) }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        {label}
      </label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              value={item}
              onChange={(e) => update(i, e.target.value)}
              className="input text-xs flex-1"
              placeholder={placeholder}
              list={suggestions ? datalistId : undefined}
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0"
                aria-label="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {suggestions && (
        <datalist id={datalistId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <button
        type="button"
        onClick={add}
        className="mt-2 text-xs text-safety-orange font-bold hover:underline flex items-center gap-1"
      >
        <Plus className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  )
}

function StockMaterialSelector({
  stockItems,
  items,
  onChange,
}: {
  stockItems: StockMaterialRef[]
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [selectedStockId, setSelectedStockId] = useState('')

  function updateItem(index: number, value: string) {
    const next = [...items]
    next[index] = value
    onChange(next.filter((x) => x.trim() !== ''))
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index)
    onChange(next)
  }

  function handleAddFromStock() {
    if (!selectedStockId) return
    const found = stockItems.find((s) => s.id === selectedStockId)
    if (!found) return
    const text = found.unit ? `${found.name} (${found.unit})` : found.name
    if (!items.includes(text)) {
      onChange([...items, text])
    }
    setSelectedStockId('')
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5 text-gray-400" />
        Materiais / Ferramentas Necessários
      </label>

      {stockItems.length > 0 && (
        <div className="flex gap-2 items-center">
          <select
            value={selectedStockId}
            onChange={(e) => setSelectedStockId(e.target.value)}
            className="input text-xs flex-1"
          >
            <option value="">-- Selecionar do Inventário --</option>
            {stockItems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.unit ? `(${s.unit})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddFromStock}
            disabled={!selectedStockId}
            className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-slate-700"
          >
            Adicionar
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                onChange={(e) => updateItem(idx, e.target.value)}
                className="input text-xs flex-1"
                placeholder="Ex.: 2x Rolamento SKF 6204, Óleo 5L..."
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Remover material"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {stockItems.length === 0 && (
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="text-xs text-safety-orange font-bold hover:underline flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Adicionar material manual
        </button>
      )}
    </div>
  )
}

export default function ProjectsClient({
  tasks,
  assets,
  users,
  role,
  userId,
}: {
  tasks: Task[]
  assets: Ref[]
  users: UserRef[]
  role: UserRole
  userId: string
}) {
  const router = useRouter()
  const { dict } = useLanguage()
  const [plans, setPlans] = useState<PlanRef[]>([])
  const [plansLoaded, setPlansLoaded] = useState(false)
  const [plansLoading, setPlansLoading] = useState(false)
  const [stockRefs, setStockRefs] = useState<StockMaterialRef[]>([])
  const [stockLoaded, setStockLoaded] = useState(false)
  const [stockLoading, setStockLoading] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')
  const [statusPending, startStatusTransition] = useTransition()

  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [selectedAssetId, setSelectedAssetId] = useState<string>('')
  const [safetyRules, setSafetyRules] = useState<string[]>([''])
  const [materialsRequired, setMaterialsRequired] = useState<string[]>([])

  const [periodicidadePlan, setPeriodicidadePlan] = useState<Periodicidade>('mensal')
  const [periodicidadeCustomPlan, setPeriodicidadeCustomPlan] = useState('')
  const [executorPlan, setExecutorPlan] = useState<Executor>('interno')
  const [legalPlan, setLegalPlan] = useState(false)

  const isManager = role === 'manager'
  const statuses: TaskStatus[] = ['pending', 'in_progress', 'done']

  function openCreate() {
    setError('')
    setEditing(null)
    setSelectedPlanId('')
    setSelectedAssetId('')
    setSafetyRules([''])
    setMaterialsRequired([])
    setPeriodicidadePlan('mensal')
    setPeriodicidadeCustomPlan('')
    setExecutorPlan('interno')
    setLegalPlan(false)
    setCreating(true)
    if (isManager && !plansLoaded && !plansLoading) {
      setPlansLoading(true)
      loadPlanTaskRefsAction().then((res) => {
        setPlans(res as PlanRef[])
        setPlansLoaded(true)
        setPlansLoading(false)
      })
    }
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
    setError('')
    setCreating(false)
    setEditing(task)
    setSelectedPlanId(task.maintenancePlanId ?? '')
    setSelectedAssetId(task.assetId ?? '')
    setSafetyRules(task.safetyRules?.length ? task.safetyRules : [''])
    setMaterialsRequired(task.materialsRequired?.length ? task.materialsRequired : [])
    if (isManager && !plansLoaded && !plansLoading) {
      setPlansLoading(true)
      loadPlanTaskRefsAction().then((res) => {
        setPlans(res as PlanRef[])
        setPlansLoaded(true)
        setPlansLoading(false)
      })
    }
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
    setError('')
  }

  function handleSelectPlan(e: React.ChangeEvent<HTMLSelectElement>) {
    const planId = e.target.value
    setSelectedPlanId(planId)
    if (!planId) return
    const plan = plans.find((p) => p.id === planId)
    if (!plan) return
    if (plan.assetId) setSelectedAssetId(plan.assetId)
    if (plan.safetyRules?.length) setSafetyRules(plan.safetyRules)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const fd = new FormData(e.currentTarget)
    fd.set('safetyRules', JSON.stringify(safetyRules.filter((r) => r.trim() !== '')))
    fd.set('materialsRequired', JSON.stringify(materialsRequired.filter((r) => r.trim() !== '')))
    if (selectedPlanId) fd.set('maintenancePlanId', selectedPlanId)

    const tipoSelected = String(fd.get('tipo') ?? '')
    if (isManager && tipoSelected === 'plano' && !selectedPlanId) {
      const planTitle = String(fd.get('title') ?? '').trim()
      const planAssetId = String(fd.get('assetId') ?? '').trim()
      const planCrit = String(fd.get('criticidade') ?? 'verde') as TaskCriticidade
      if (planTitle && planAssetId) {
        const planFd = new FormData()
        planFd.set('title', planTitle)
        planFd.set('assetId', planAssetId)
        planFd.set('criticidade', planCrit)
        planFd.set('periodicidade', periodicidadePlan)
        if (periodicidadeCustomPlan) planFd.set('periodicidadeLabel', periodicidadeCustomPlan)
        planFd.set('executor', executorPlan)
        if (legalPlan) planFd.set('legal', 'on')
        const planRes = await createMaintenancePlanAction({}, planFd)
        if (planRes.error) {
          setError(`Erro ao criar plano: ${planRes.error}`)
          setBusy(false)
          return
        }
      }
    }

    let result
    if (creating) {
      result = await createProjectTaskAction({}, fd)
    } else if (editing) {
      fd.set('id', editing.id)
      result = await updateProjectTaskAction({}, fd)
    } else {
      setBusy(false)
      return
    }

    setBusy(false)
    if (result.error) setError(result.error)
    else { closeModal(); router.refresh() }
  }

  async function handleDelete(task: Task) {
    if (!confirm(`Eliminar "${task.title}"?`)) return
    await deleteProjectTaskAction(task.id)
    router.refresh()
  }

  function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    startStatusTransition(async () => {
      await updateProjectTaskStatusAction(taskId, newStatus)
      router.refresh()
    })
  }

  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, (u as any).abbreviation || u.name])), [users])

  const assetName = (id?: string | null) => (id ? assetMap.get(id) ?? '—' : '—')
  const userName = (id?: string | null) => (id ? userMap.get(id) ?? id ?? '—' : '—')

  useEffect(() => { setCurrentPage(1) }, [search, filter, pageSize])

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const aName = assetName(t.assetId)
        const uName = userName(t.assignedTo)
        const haystack = `${t.title || ''} ${t.description || ''} ${(t as any).tag || ''} ${(t as any).area || ''} ${aName} ${uName}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [tasks, filter, search, assetMap, userMap])

  const { sorted: shown, sortKey, sortDir, toggleSort } = useTableSort<Task>(
    filtered,
    {
      title: (t) => t.title?.toLowerCase(),
      tipo: (t) => TIPO_LABELS[t.tipo] ?? t.tipo,
      asset: (t) => assetName(t.assetId),
      assignee: (t) => userName(t.assignedTo),
      status: (t) => STATUS_LABELS[t.status],
      dueDate: (t) => t.dueDate ?? null,
    },
    null,
  )

  const effectivePageSize = pageSize === -1 ? (shown.length || 1) : pageSize
  const totalPages = Math.ceil(shown.length / effectivePageSize) || 1
  const currentShown = useMemo(() => {
    if (pageSize === -1) return shown
    const start = (currentPage - 1) * pageSize
    return shown.slice(start, start + pageSize)
  }, [shown, currentPage, pageSize])

  const modalActive = creating || editing !== null

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline/60 gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-extrabold text-industrial-blue tracking-tight truncate flex items-center gap-2">
            <FolderKanban size={26} className="text-safety-orange" />
            Projetos & OTs de Projeto
          </h1>
          <p className="text-xs sm:text-sm font-medium text-industrial-blue-light mt-1">
            A mostrar {shown.length} / {tasks.length} tarefa(s) de projeto
          </p>
        </div>
        <button onClick={openCreate} className="shrink-0 h-9 sm:h-11 px-3 sm:px-5 bg-safety-orange hover:bg-safety-orange/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-safety-orange/15 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
          <Plus size={16} className="stroke-[2.5] shrink-0" />
          <span className="hidden sm:inline">Novo Projeto</span>
        </button>
      </div>

      {/* Filtros por estado, pesquisa e tamanho de página */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap items-center">
          {(['all', ...statuses] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                filter === s ? 'bg-industrial-blue text-white' : 'bg-white border border-outline text-industrial-blue-light hover:bg-slate-50 hover:text-industrial-blue'
              }`}
            >
              {s === 'all' ? 'Todos os Projetos' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar Projeto, TAG..."
            className="input text-xs py-1.5 px-3 w-48 sm:w-64"
          />
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="input text-xs py-1 px-2 w-auto"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={-1}>Todas ({tasks.length})</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {shown.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400">
            <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Sem tarefas de projeto neste filtro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider">
                  <SortableTh label="ID" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="DATA" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="ÁREA" sortableKey="asset" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="EQUIPAMENTO / TAG" sortableKey="asset" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="TI" sortableKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="PROJETO / DESCRIÇÃO" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="TÉCNICOS" sortableKey="assignee" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="INÍCIO" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
                  <SortableTh label="FIM" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
                  <SortableTh label="CAUSA / OBS" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
                  <SortableTh label="ESTADO" sortableKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-2 text-right font-mono text-xs font-bold text-slate-700 uppercase tracking-wider">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {currentShown.map((t, idx) => {
                  const asset = assets.find((a) => a.id === t.assetId)
                  const formattedId = format3DigitId(t.id, idx)
                  return (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200">{formattedId}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {(t as any).area || (asset as any)?.area || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {(asset as any)?.tag || asset?.name || (t as any).tag || '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                          {t.tipo === 'preventiva' ? 'MP' : t.tipo === 'curativa' ? 'MC' : t.tipo === 'plano' ? 'PM' : (TIPO_LABELS[t.tipo] || t.tipo?.toUpperCase() || 'MC')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-900 font-semibold max-w-[280px]">
                        <Link href={`/dashboard/tasks/${t.id}`} className="hover:text-safety-orange transition-colors underline-offset-2 hover:underline">
                          {t.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-slate-800 font-semibold whitespace-nowrap">
                        {userName(t.assignedTo)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 hidden xl:table-cell whitespace-nowrap">
                        {formatDateTime(t.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 hidden xl:table-cell whitespace-nowrap">
                        {t.updatedAt ? formatDateTime(t.updatedAt) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 hidden lg:table-cell max-w-[200px]">
                        <span className="line-clamp-2" title={t.description ?? ''}>{t.description || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          t.status === 'done' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          t.status === 'in_progress' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}>
                          {STATUS_LABELS[t.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/dashboard/tasks/${t.id}`} className="p-1 text-slate-600 hover:text-industrial-blue hover:bg-slate-100 rounded" title="Ver detalhes">
                            <Eye size={15} />
                          </Link>
                          {isManager && (
                            <>
                              <button onClick={() => openEdit(t)} className="p-1 text-slate-600 hover:text-industrial-blue hover:bg-slate-100 rounded" title="Editar">
                                <Pencil size={15} />
                              </button>
                              <button onClick={() => handleDelete(t)} className="p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Criar / Editar Projeto */}
      {modalActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-extrabold text-industrial-blue dark:text-slate-100 flex items-center gap-2">
                <FolderKanban className="text-safety-orange" size={20} />
                {creating ? 'Novo Projeto / OT de Projeto' : 'Editar Projeto'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Título do Projeto *
                </label>
                <input
                  name="title"
                  defaultValue={editing?.title ?? ''}
                  placeholder="Ex: Instalação de novo sistema de filtragem"
                  className="input font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Equipamento / TAG
                  </label>
                  <select
                    name="assetId"
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="">-- Sem equipamento --</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Responsável
                  </label>
                  <select
                    name="assignedTo"
                    defaultValue={editing?.assignedTo ?? ''}
                    className="input text-xs"
                  >
                    <option value="">-- Atribuir a técnico --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.abbreviation ? `(${u.abbreviation})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Tipo de Intervenção (TI)
                  </label>
                  <select name="tipo" defaultValue={editing?.tipo ?? 'curativa'} className="input text-xs">
                    <option value="curativa">MC - Manutenção Curativa</option>
                    <option value="preventiva">MP - Manutenção Preventiva</option>
                    <option value="plano">PM - Plano de Manutenção</option>
                    <option value="inspecao">INS - Inspeção</option>
                    <option value="lubrificacao">LUB - Lubrificação</option>
                    <option value="calibracao">CAL - Calibração</option>
                    <option value="outro">OUT - Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Criticidade
                  </label>
                  <select name="criticidade" defaultValue={editing?.criticidade ?? 'verde'} className="input text-xs">
                    <option value="verde">Verde (Normal)</option>
                    <option value="amarelo">Amarelo (Média)</option>
                    <option value="vermelho">Vermelho (Urgente)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Estado
                  </label>
                  <select name="status" defaultValue={editing?.status ?? 'pending'} className="input text-xs">
                    <option value="pending">Pendente</option>
                    <option value="in_progress">Em Curso</option>
                    <option value="done">Concluída</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Descrição / Objetivos do Projeto
                </label>
                <textarea
                  name="description"
                  defaultValue={editing?.description ?? ''}
                  rows={3}
                  placeholder="Detalhes, especificações e requisitos do projeto..."
                  className="input text-xs"
                />
              </div>

              <DynamicList
                label="Regras de Segurança / EPIs"
                icon={ShieldAlert}
                items={safetyRules}
                onChange={setSafetyRules}
                placeholder="Ex.: EPI: Capacete, Bloqueio LOTO..."
                addLabel="Adicionar regra de segurança"
                suggestions={PREDEFINED_SAFETY_RULES}
              />

              <StockMaterialSelector
                stockItems={stockRefs}
                items={materialsRequired}
                onChange={setMaterialsRequired}
              />

              {error && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={closeModal} className="btn-secondary text-xs">
                  {dict.common.cancel}
                </button>
                <button type="submit" disabled={busy} className="btn-primary text-xs font-bold">
                  {busy ? 'A guardar...' : dict.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
