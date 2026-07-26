'use client'

import { useState, useEffect, useTransition, useId, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, ClipboardList, X, Play, CheckCircle2,
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
  createTaskAction, updateTaskAction, deleteTaskAction, updateTaskStatusAction,
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
  'EPI: Máscara respiratória',
  'Desligar energia (Lockout/Tagout)',
  'Ventilar o espaço confinado',
  'Sinalizar a zona de trabalho',
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
        {items.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={val}
              onChange={(e) => update(i, e.target.value)}
              className="input flex-1 text-sm"
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
        className="mt-2 text-xs font-bold text-safety-orange hover:text-safety-orange/80 transition-colors flex items-center gap-1"
      >
        <Plus className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  )
}

/** Materiais a utilizar: selecionados da BD Stocks, não texto livre (tarefa 09). */
function StockMaterialsList({
  items,
  onChange,
  stockRefs,
  stockLoading,
}: {
  items: string[]
  onChange: (items: string[]) => void
  stockRefs: StockMaterialRef[]
  stockLoading: boolean
}) {
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
        <Package className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
        Materiais a utilizar
      </label>
      {!stockLoading && stockRefs.length === 0 ? (
        <p className="text-xs text-gray-500">
          Sem itens em Stock. Cria stock primeiro para poderes associar materiais a esta tarefa.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((val, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={stockRefs.some((s) => s.name === val) ? val : ''}
                  onChange={(e) => update(i, e.target.value)}
                  className="input flex-1 text-sm"
                  disabled={stockLoading}
                >
                  <option value="">— Selecionar da Stock —</option>
                  {stockRefs.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}{s.unit ? ` (${s.unit})` : ''}</option>
                  ))}
                </select>
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
          <button
            type="button"
            onClick={add}
            className="mt-2 text-xs font-bold text-safety-orange hover:text-safety-orange/80 transition-colors flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Adicionar material
          </button>
        </>
      )}
    </div>
  )
}

export default function TasksClient({
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
  // Planos carregados sob demanda (só quando o tipo passa a "Plano") — não pesam em cada visita.
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

  const [safetyRules, setSafetyRules] = useState<string[]>([''])
  const [materialsRequired, setMaterialsRequired] = useState<string[]>([''])

  // Campos controlados (para a feature "tarefas do plano por equipamento")
  const [title, setTitle] = useState('')
  const [tipo, setTipo] = useState<TipoTarefa>('preventiva')
  const [criticidade, setCriticidade] = useState<TaskCriticidade>('verde')
  const [assetId, setAssetId] = useState('')
  const [maintenancePlanId, setMaintenancePlanId] = useState('')
  const [novaPeriodicidade, setNovaPeriodicidade] = useState<Periodicidade | ''>('')

  const isManager = role === 'manager'
  const showForm = creating || editing !== null

  useEffect(() => {
    setSafetyRules(editing?.safetyRules?.length ? editing.safetyRules : [''])
    setMaterialsRequired(editing?.materialsRequired?.length ? editing.materialsRequired : [''])
    setTitle(editing?.title ?? '')
    setTipo(editing?.tipo ?? 'preventiva')
    setCriticidade(editing?.criticidade ?? 'verde')
    setAssetId(editing?.assetId ?? '')
    setMaintenancePlanId(editing?.maintenancePlanId ?? '')
    setNovaPeriodicidade('')
  }, [editing])

  // Carrega os planos sob demanda (1×) quando o tipo passa a "Plano"
  async function ensurePlansLoaded() {
    if (plansLoaded || plansLoading) return
    setPlansLoading(true)
    try {
      const refs = await loadPlanTaskRefsAction()
      setPlans(refs.map((r) => ({ ...r, assetId: r.assetId ?? '' })))
      setPlansLoaded(true)
    } finally {
      setPlansLoading(false)
    }
  }
  useEffect(() => {
    if (tipo === 'plano') void ensurePlansLoaded()
  }, [tipo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega a Stock sob demanda (1×) quando o modal de criação/edição abre
  async function ensureStockLoaded() {
    if (stockLoaded || stockLoading) return
    setStockLoading(true)
    try {
      const refs = await loadStockRefsAction()
      setStockRefs(refs)
      setStockLoaded(true)
    } finally {
      setStockLoading(false)
    }
  }
  useEffect(() => {
    if (showForm) void ensureStockLoaded()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm])

  // Planos do equipamento selecionado (só relevante para tarefas tipo "plano")
  const planosDoEquipamento = assetId ? plans.filter((p) => p.assetId === assetId) : []

  function aplicarPlano(p: PlanRef) {
    setTitle(p.title)
    setCriticidade(p.criticidade)
    setMaintenancePlanId(p.id)
    setNovaPeriodicidade('')
    if (p.safetyRules?.length) setSafetyRules(p.safetyRules)
  }

  function openCreate() {
    setSafetyRules([''])
    setMaterialsRequired([''])
    setTitle('')
    setTipo('preventiva')
    setCriticidade('verde')
    setAssetId('')
    setMaintenancePlanId('')
    setNovaPeriodicidade('')
    setError('')
    setCreating(true)
  }

  function closeModal() {
    setEditing(null)
    setCreating(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    const safetyFiltered = safetyRules.filter((r) => r.trim())
    const matsFiltered = materialsRequired.filter((m) => m.trim())
    if (safetyFiltered.length) formData.set('safetyRules', JSON.stringify(safetyFiltered))
    if (matsFiltered.length) formData.set('materialsRequired', JSON.stringify(matsFiltered))

    // Tarefa tipo "Plano" sem plano existente selecionado + periodicidade definida:
    // cria automaticamente o Plano de Manutenção e liga a tarefa a ele.
    if (tipo === 'plano' && !maintenancePlanId && novaPeriodicidade) {
      const planForm = new FormData()
      planForm.set('title', title)
      planForm.set('criticidade', criticidade)
      planForm.set('tipo', 'plano')
      planForm.set('periodicidade', novaPeriodicidade)
      planForm.set('executor', 'interno')
      planForm.set('assetId', assetId)
      const assignedTo = formData.get('assignedTo')
      if (assignedTo) planForm.set('assignedTo', String(assignedTo))
      if (safetyFiltered.length) planForm.set('safetyRules', JSON.stringify(safetyFiltered))
      const planResult = await createMaintenancePlanAction({}, planForm)
      if (planResult.error) {
        setBusy(false)
        setError(`Erro ao criar plano de manutenção: ${planResult.error}`)
        return
      }
      if (planResult.id) formData.set('maintenancePlanId', planResult.id)
    }

    const result = editing
      ? await updateTaskAction({}, formData)
      : await createTaskAction({}, formData)
    setBusy(false)
    if (result.error) setError(result.error)
    else { closeModal(); router.refresh() }
  }

  async function handleDelete(task: Task) {
    if (!confirm(`Eliminar "${task.title}"?`)) return
    await deleteTaskAction(task.id)
    router.refresh()
  }

  function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    startStatusTransition(async () => {
      await updateTaskStatusAction(taskId, newStatus)
      router.refresh()
    })
  }

  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])

  const assetName = (id?: string | null) => (id ? assetMap.get(id) ?? '—' : '—')
  const userName = (id?: string | null) => (id ? userMap.get(id) ?? '—' : '—')
  const userRef = (id?: string | null) => users.find((u) => u.id === id)

  useEffect(() => { setCurrentPage(1) }, [search, filter, pageSize])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false
      if (q) {
        const aName = assetName(t.assetId)
        const uName = userName(t.assignedTo)
        const haystack = `${t.title || ''} ${t.description || ''} ${(t as any).tag || ''} ${(t as any).area || ''} ${aName} ${uName}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [tasks, filter, search, assetMap, userMap])

  // Ordenação por coluna (tarefa 15)
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
    return shown.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  }, [shown, currentPage, pageSize])

  const statuses: TaskStatus[] = ['pending', 'in_progress', 'done', 'cancelled']
  const criticidades: TaskCriticidade[] = ['vermelho', 'amarelo', 'verde']
  const tipos: TipoTarefa[] = ['preventiva', 'curativa', 'plano', 'inspecao', 'lubrificacao', 'calibracao', 'outro']

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline/60 gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-extrabold text-industrial-blue tracking-tight truncate">
            {isManager ? dict.tasks.managerTasks : dict.tasks.myTasks}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-industrial-blue-light mt-1">
            A mostrar {shown.length} / {tasks.length} OT(s)
          </p>
        </div>
        <button onClick={openCreate} className="shrink-0 h-9 sm:h-11 px-3 sm:px-5 bg-safety-orange hover:bg-safety-orange/90 text-white rounded-xl font-bold text-sm shadow-lg shadow-safety-orange/15 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
          <Plus size={16} className="stroke-[2.5] shrink-0" />
          <span className="hidden sm:inline">{dict.tasks.newTask}</span>
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
              {s === 'all' ? dict.tasks.allTasks : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar OT, TAG, Equipamento..."
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
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{dict.tasks.empty}</p>
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
                  <SortableTh label="AVARIA / DESCRIÇÃO" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
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
                          {t.tipo?.toUpperCase()}
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'done' ? 'bg-green-100 text-green-900 border border-green-300' :
                          t.status === 'in_progress' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                          t.status === 'cancelled' ? 'bg-slate-100 text-slate-700 border border-slate-300' :
                          'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}>
                          {STATUS_LABELS[t.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/dashboard/tasks/${t.id}`} className="p-1 text-slate-500 hover:text-blue-600 rounded" title="Ver Detalhes">
                            <Eye className="h-4 w-4" />
                          </Link>
                          {isManager && (
                            <>
                              <button onClick={() => setEditing(t)} className="p-1 text-slate-500 hover:text-blue-600 rounded" title="Editar">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => handleDelete(t)} className="p-1 text-slate-500 hover:text-red-600 rounded" title="Eliminar">
                                <Trash2 className="h-4 w-4" />
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

        {totalPages > 1 && pageSize !== -1 && (
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 px-4 py-3 bg-gray-50/50 dark:bg-slate-900/50">
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Página {currentPage} de {totalPages} ({shown.length} OTs)
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

      {/* Modal criar / editar */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="card relative w-full max-w-lg p-6 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{editing ? dict.tasks.modalEdit : dict.tasks.modalNew}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <input type="hidden" name="maintenancePlanId" value={maintenancePlanId} />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Título *</label>
                <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} className="input" required placeholder="Ex.: Lubrificação mensal" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Tipo de OT *</label>
                  <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoTarefa)} className="input">
                    {tipos.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Criticidade *</label>
                  <select name="criticidade" value={criticidade} onChange={(e) => setCriticidade(e.target.value as TaskCriticidade)} className="input">
                    {criticidades.map((c) => <option key={c} value={c}>{CRITICIDADE_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Equipamento *</label>
                  <select
                    name="assetId"
                    value={assetId}
                    onChange={(e) => { setAssetId(e.target.value); setMaintenancePlanId('') }}
                    className="input"
                    required
                  >
                    <option value="">— Selecionar Equipamento —</option>
                    {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {assets.length === 0 && (
                    <p className="text-[10px] text-red-500 font-medium mt-1">
                      Não tens equipamentos criados. Deves criar pelo menos um equipamento no módulo de Equipamentos antes de registar uma OT.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Responsável</label>
                  <select name="assignedTo" defaultValue={editing ? (editing.assignedTo ?? '') : (role === 'technician' ? userId : '')} className="input">
                    <option value="">— Ninguém —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Tarefas do Plano de Manutenção para o equipamento escolhido */}
              {tipo === 'plano' && assetId && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-blue-800 mb-2">
                    <ClipboardList className="h-4 w-4" />
                    OTs do Plano de Manutenção para este equipamento
                  </div>
                  {plansLoading && !plansLoaded ? (
                    <p className="text-xs text-gray-500">A carregar planos…</p>
                  ) : planosDoEquipamento.length === 0 ? (
                    <p className="text-xs text-gray-500">Não há OTs de plano definidas para este equipamento.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                      {planosDoEquipamento.map((p) => {
                        const sel = maintenancePlanId === p.id
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => aplicarPlano(p)}
                              className={`w-full text-left rounded-md border px-2.5 py-2 text-sm transition-colors ${
                                sel ? 'border-blue-500 bg-white ring-1 ring-blue-300' : 'border-gray-200 bg-white hover:border-blue-300'
                              }`}
                            >
                              <span className="font-medium text-gray-800">{p.title}</span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                                {p.periodicidade && (
                                  <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                                    <CalendarClock className="h-3 w-3" />
                                    {PERIODICIDADE_LABELS[p.periodicidade]}
                                  </span>
                                )}
                                {p.executor === 'externo' && (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                                    <Building2 className="h-3 w-3" /> Externo
                                  </span>
                                )}
                                {p.legal && (
                                  <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-red-700">
                                    <Scale className="h-3 w-3" /> Legal
                                  </span>
                                )}
                                {p.months && <span className="text-gray-400">{p.months}</span>}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {maintenancePlanId && (
                    <button
                      type="button"
                      onClick={() => setMaintenancePlanId('')}
                      className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Limpar plano selecionado
                    </button>
                  )}
                  {!maintenancePlanId && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <label className="block text-xs font-medium text-blue-800 mb-1.5">
                        Ou define a periodicidade — cria automaticamente um novo Plano de Manutenção ligado a esta OT
                      </label>
                      <select
                        value={novaPeriodicidade}
                        onChange={(e) => setNovaPeriodicidade(e.target.value as Periodicidade | '')}
                        className="input text-sm"
                      >
                        <option value="">— OT pontual, sem periodicidade —</option>
                        {PERIODICIDADE_OPTIONS.map((p) => <option key={p} value={p}>{PERIODICIDADE_LABELS[p]}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição</label>
                <textarea name="description" defaultValue={editing?.description ?? ''} className="input" rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Estado</label>
                  <select name="status" defaultValue={editing?.status ?? 'pending'} className="input">
                    {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Prazo</label>
                  <input type="date" name="dueDate" defaultValue={editing?.dueDate ?? ''} className="input" />
                </div>
              </div>

              {/* Regras de segurança */}
              <DynamicList
                label="Regras de segurança"
                icon={ShieldAlert}
                items={safetyRules}
                onChange={setSafetyRules}
                placeholder="Ex.: Usar EPI, desligar máquina antes…"
                addLabel="Adicionar regra"
                suggestions={PREDEFINED_SAFETY_RULES}
              />

              {/* Materiais a utilizar — vêm da BD Stocks, não texto livre (tarefa 09) */}
              <StockMaterialsList
                items={materialsRequired}
                onChange={setMaterialsRequired}
                stockRefs={stockRefs}
                stockLoading={stockLoading}
              />

              {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{error}</div>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">{dict.common.cancel}</button>
                <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? dict.common.loading : dict.common.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
