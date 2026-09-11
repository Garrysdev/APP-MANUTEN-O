'use client'

import { useState, useEffect, useTransition, useId, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ExcelJS from 'exceljs'
import {
  Plus, Pencil, Trash2, ClipboardList, X, Play, CheckCircle2,
  ShieldAlert, Package, CalendarClock, Building2, Scale, Eye,
  FileSpreadsheet, Printer, Upload, Filter, ChevronDown, ChevronUp, Clock,
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
import MaterialsSelector from '@/components/ui/MaterialsSelector'
import SearchableAssetSelect from '@/components/ui/SearchableAssetSelect'
import { TaskDocPickerManager } from '@/components/ui/TaskDocRequirements'
import { TipoBadge } from '@/components/ui/TipoBadge'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import {
  createTaskAction, updateTaskAction, deleteTaskAction, updateTaskStatusAction,
  loadPlanTaskRefsAction, loadStockRefsAction, loadCompletedTasksAction, type StockMaterialRef,
} from './actions'
import ExcelDateFilter, { ExcelColumnDateFilter, ExcelDateFilterValues, DEFAULT_EXCEL_DATE_FILTER, filterByExcelDate } from '@/components/ui/ExcelDateFilter'
import { createMaintenancePlanAction, importMaintenancePlansAction } from '../maintenance-plan/actions'
import CreateTaskModal from '@/components/modals/CreateTaskModal'
import TaskSummaryModal from '@/components/modals/TaskSummaryModal'
import MultiSelectPopoverFilter from '@/components/ui/MultiSelectPopoverFilter'
import { matchesTechFilter, isTaskAssignedToUser } from '@/lib/task-assignment'

const PERIODICIDADE_OPTIONS: Periodicidade[] = ['semanal', 'mensal', 'trimestral', 'bianual', 'anual', 'bienal', 'trianual', 'horas', 'pontual']

type Ref = { id: string; name: string; tag?: string | null; area?: string | null }
type UserRef = Ref & { avatarUrl?: string | null; active?: boolean; abbreviation?: string | null; isExternal?: boolean | null; externalCompanyName?: string | null; role?: string | null }

function isInternalUser(u: any): boolean {
  if (!u || u.active === false) return false
  if (u.isExternal === true || u.isExternal === 'true') return false
  if (u.role === 'external') return false
  if (u.externalCompanyName && u.externalCompanyName.trim()) return false
  if (u.externalCompanyId && u.externalCompanyId.trim()) return false
  const n = (u.name || '').toLowerCase()
  const e = (u.email || '').toLowerCase()
  const a = (u.abbreviation || '').toLowerCase()
  const id = (u.id || '').toLowerCase()
  if (n.includes('carrier') || e.includes('carrier') || a.includes('carrier') || id.includes('carrier')) return false
  if (n.includes('schindler') || e.includes('schindler') || a.includes('schindler') || id.includes('schindler')) return false
  if (n.includes('ox2') || e.includes('ox2') || a.includes('ox2') || id.includes('ox2')) return false
  if (n.includes('block') || e.includes('block') || a.includes('block') || id.includes('block')) return false
  if (n.includes('heleno') || e.includes('heleno') || a.includes('heleno') || id.includes('heleno')) return false
  if (n.includes('prestador') || n.includes('externo')) return false
  return true
}
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

function TaskMaterialsPicker({
  items,
  onChange,
  stockRefs,
  stockLoading,
  onStockItemCreated,
}: {
  items: string[]
  onChange: (items: string[]) => void
  stockRefs: StockMaterialRef[]
  stockLoading: boolean
  onStockItemCreated?: (newItem: StockMaterialRef) => void
}) {
  return (
    <MaterialsSelector
      items={items}
      onChange={onChange}
      stockRefs={stockRefs}
      onStockItemCreated={onStockItemCreated}
    />
  )
}

export default function TasksClient({
  tasks,
  assets,
  users,
  externalCompanies = [],
  role,
  userId,
}: {
  tasks: Task[]
  assets: Ref[]
  users: UserRef[]
  externalCompanies?: any[]
  role: UserRole
  userId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dict } = useLanguage()
  // Planos carregados sob demanda (só quando o tipo passa a "Plano") — não pesam em cada visita.
  const [plans, setPlans] = useState<PlanRef[]>([])
  const [plansLoaded, setPlansLoaded] = useState(false)
  const [plansLoading, setPlansLoading] = useState(false)
  const [stockRefs, setStockRefs] = useState<StockMaterialRef[]>([])
  const [stockLoaded, setStockLoaded] = useState(false)
  const [stockLoading, setStockLoading] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [summaryTask, setSummaryTask] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>(() => {
    const pStatus = searchParams.get('status')
    if (pStatus) {
      const list = pStatus.split(',').map((s) => s.trim() as TaskStatus).filter(Boolean)
      if (list.length > 0) return list
    }
    return ['pending', 'in_progress'] // DEFAULT: Mostrar apenas as OTs ATIVAS ao abrir a página
  })
  const [selectedTIs, setSelectedTIs] = useState<string[]>([])
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTechs, setSelectedTechs] = useState<string[]>([])
  const [statusPending, startStatusTransition] = useTransition()

  // Carregamento de OTs Concluídas / Histórico sob demanda (de folha em folha)
  const [extraCompletedTasks, setExtraCompletedTasks] = useState<Task[]>([])
  const [loadingCompleted, setLoadingCompleted] = useState(false)
  const [completedLoaded, setCompletedLoaded] = useState(false)

  useEffect(() => {
    const wantsCompleted = selectedStatuses.includes('done') || selectedStatuses.includes('cancelled')
    if (wantsCompleted && !completedLoaded && !loadingCompleted) {
      setLoadingCompleted(true)
      loadCompletedTasksAction(1, 250).then((res) => {
        setExtraCompletedTasks(res.tasks || [])
        setCompletedLoaded(true)
        setLoadingCompleted(false)
      }).catch(() => {
        setLoadingCompleted(false)
      })
    }
  }, [selectedStatuses, completedLoaded, loadingCompleted])

  const [safetyRules, setSafetyRules] = useState<string[]>([''])
  const [materialsRequired, setMaterialsRequired] = useState<string[]>([''])
  const [requiredFRs, setRequiredFRs] = useState<string[]>([])
  const [requiredITs, setRequiredITs] = useState<string[]>([])

  // Campos controlados (para a feature "tarefas do plano por equipamento")
  const [title, setTitle] = useState('')
  const [tipo, setTipo] = useState<TipoTarefa>('preventiva')
  const [criticidade, setCriticidade] = useState<TaskCriticidade>('verde')
  const [assetId, setAssetId] = useState('')
  const [maintenancePlanId, setMaintenancePlanId] = useState('')
  const [novaPeriodicidade, setNovaPeriodicidade] = useState<Periodicidade | ''>('')
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([])

  const isManager = role === 'manager'
  const showForm = creating || editing !== null

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setCreating(true)
      const pAssetId = searchParams.get('assetId') || searchParams.get('asset') || searchParams.get('tag') || searchParams.get('qrTag') || searchParams.get('id')
      if (pAssetId) {
        setAssetId(pAssetId)
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (editing) {
      const ids = (editing.assignedToIds && editing.assignedToIds.length > 0)
        ? editing.assignedToIds
        : (editing.assignedTo ? [editing.assignedTo] : [])
      setSelectedTechIds(ids)
    } else if (creating) {
      setSelectedTechIds(role === 'technician' ? [userId] : [])
    }
  }, [editing, creating, role, userId])

  useEffect(() => {
    if (editing) {
      setSafetyRules(editing.safetyRules?.length ? editing.safetyRules : [''])
      setMaterialsRequired(editing.materialsRequired?.length ? editing.materialsRequired : [''])
      setRequiredFRs(editing.requiredFRs ?? [])
      setRequiredITs(editing.requiredITs ?? [])
      setTitle(editing.title ?? '')
      setTipo(editing.tipo ?? 'preventiva')
      setCriticidade(editing.criticidade ?? 'verde')
      setAssetId(editing.assetId ?? '')
      setMaintenancePlanId(editing.maintenancePlanId ?? '')
      setNovaPeriodicidade('')
    }
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
    if (!isManager) return
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

  function openEdit(t: Task) {
    setEditing(t)
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
    if (requiredFRs.length) formData.set('requiredFRs', JSON.stringify(requiredFRs))
    if (requiredITs.length) formData.set('requiredITs', JSON.stringify(requiredITs))

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
      const res = await updateTaskStatusAction(taskId, newStatus)
      if (res?.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
    })
  }

  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [areaFilter, setAreaFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [excelDateFilter, setExcelDateFilter] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [excelInicioFilter, setExcelInicioFilter] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [excelFimFilter, setExcelFimFilter] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const emptyCol = { id: '', data: '', area: '', tag: '', ti: '', avaria: '', tecnico: '', obs: '' }
  const [colF, setColF] = useState(emptyCol)
  const setCol = (k: keyof typeof emptyCol, v: string) => {
    setCurrentPage(1)
    setColF((c) => ({ ...c, [k]: v }))
  }

  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeFiltersCount = useMemo(() => {
    let cnt = 0
    if (selectedAreas.length > 0) cnt += selectedAreas.length
    if (selectedTags.length > 0) cnt += selectedTags.length
    if (selectedTIs.length > 0) cnt += selectedTIs.length
    if (selectedTechs.length > 0) cnt += selectedTechs.length
    if (colF.id) cnt++
    if (colF.data) cnt++
    if (colF.area) cnt++
    if (colF.tag) cnt++
    if (colF.ti) cnt++
    if (colF.avaria) cnt++
    if (colF.tecnico) cnt++
    if (colF.obs) cnt++
    return cnt
  }, [selectedAreas, selectedTags, selectedTIs, selectedTechs, colF])

  const getTaskDisplayDateTime = (task: Task) => {
    const d = task.plannedStartDate || task.createdAt
    if (!d) return '—'
    if (task.plannedStartDate && (task.plannedStartDate.includes('T') || task.plannedStartDate.includes(':'))) {
      return formatDateTime(task.plannedStartDate)
    }
    if (task.createdAt && (task.createdAt.includes('T') || task.createdAt.includes(':'))) {
      const dOnly = formatDate(task.plannedStartDate || task.createdAt)
      const cObj = new Date(task.createdAt)
      if (!isNaN(cObj.getTime())) {
        const hh = String(cObj.getHours()).padStart(2, '0')
        const mm = String(cObj.getMinutes()).padStart(2, '0')
        return `${dOnly} ${hh}:${mm}`
      }
    }
    return formatDateTime(d)
  }

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, (u as any).abbreviation || u.name])), [users])

  const resolveTechLabel = (idOrAbbr?: string | null): string => {
    if (!idOrAbbr) return '—'
    const raw = String(idOrAbbr).trim()
    if (!raw || raw === '—' || raw === 'N/D') return '—'

    const u = users.find(
      (usr) =>
        usr.id === raw ||
        (usr.abbreviation && usr.abbreviation.toUpperCase() === raw.toUpperCase()) ||
        (usr.name || '').toLowerCase() === raw.toLowerCase()
    )

    if (u) {
      const clean = u.name.replace(/^([A-Z]{2,4}\s*[-–—]\s*)/i, '').replace(/\(.*?\)/g, '').trim() || u.name
      if (u.abbreviation) {
        return `${u.abbreviation} - ${clean}`
      }
      return clean
    }

    const KNOWN: Record<string, string> = {
      'mWSsTRtgq5QcOHusTdVYgDVrwHt2': 'RG - RuiG',
      'MEGjjvqtGqv3Oosxvlrx': 'LM - Leandro Maia',
      'nAcCSm4E3tNnPLr72UPl': 'MS - Marco Silva',
      'zmDAeoGTzIWPavraKu0f': 'CB - Carlos Branco',
      'nLqzaMwMu1OR4CKZzatjTlNBWt82': 'RG - Rui Garrido',
      'q17h5HdG3R8dfjWiUZ6V': 'JR - João Ramos',
      'twtQs1sAj0RFc9KI2S0n': 'OX2 - Miguel',
      '2pL85QsrLpaNwYXZdVOP': 'CAR - Carrier',
      'tech_BlockControl': 'BLK - BlockControl',
      'tech_Schindler': 'SCH - Schindler',
      'tech_Helenos': 'HEL - Helenos',
      'RG': 'RG - RuiG',
      'LM': 'LM - Leandro Maia',
      'MS': 'MS - Marco Silva',
      'CB': 'CB - Carlos Branco',
    }

    if (KNOWN[raw]) return KNOWN[raw]
    if (KNOWN[raw.toUpperCase()]) return KNOWN[raw.toUpperCase()]

    if (/^[a-zA-Z0-9_-]{18,}$/.test(raw)) {
      return 'Técnico'
    }

    return raw
  }

  const resolveTechInitials = (idOrAbbr?: string | null): string => {
    if (!idOrAbbr) return '—'
    const raw = String(idOrAbbr).trim()
    if (!raw || raw === '—' || raw === 'N/D') return '—'

    const u = users.find(
      (usr) =>
        usr.id === raw ||
        (usr.abbreviation && usr.abbreviation.toUpperCase() === raw.toUpperCase()) ||
        (usr.name || '').toLowerCase() === raw.toLowerCase()
    )

    if (u?.abbreviation) return u.abbreviation.toUpperCase()

    const KNOWN_INITIALS: Record<string, string> = {
      'mWSsTRtgq5QcOHusTdVYgDVrwHt2': 'RG',
      'MEGjjvqtGqv3Oosxvlrx': 'LM',
      'nAcCSm4E3tNnPLr72UPl': 'MS',
      'zmDAeoGTzIWPavraKu0f': 'CB',
      'CUodZKziOwo128GLK66i': 'RG',
      'nLqzaMwMu1OR4CKZzatjTlNBWt82': 'ADM',
      'q17h5HdG3R8dfjWiUZ6V': 'JR',
      'twtQs1sAj0RFc9KI2S0n': 'OX2',
      '2pL85QsrLpaNwYXZdVOP': 'CAR',
      'tech_BlockControl': 'BLK',
      'tech_Schindler': 'SCH',
      'tech_Helenos': 'HEL',
      'RG': 'RG',
      'LM': 'LM',
      'MS': 'MS',
      'CB': 'CB',
      'JR': 'JR',
      'OX2': 'OX2',
      'CAR': 'CAR',
      'SCH': 'SCH',
      'HEL': 'HEL',
      'BLK': 'BLK',
      'ADM': 'ADM',
    }

    if (KNOWN_INITIALS[raw]) return KNOWN_INITIALS[raw]
    if (KNOWN_INITIALS[raw.toUpperCase()]) return KNOWN_INITIALS[raw.toUpperCase()]

    if (u?.name) {
      const parts = u.name.trim().split(/\s+/)
      if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      return u.name.slice(0, 3).toUpperCase()
    }

    if (/^[a-zA-Z0-9_-]{18,}$/.test(raw)) {
      return 'TEC'
    }

    if (raw.length <= 4) return raw.toUpperCase()
    return raw.slice(0, 3).toUpperCase()
  }

  const assetName = (id?: string | null) => (id ? assetMap.get(id) ?? '—' : '—')
  const userName = (id?: string | null) => resolveTechLabel(id)

  const combinedTasks = useMemo(() => {
    if (extraCompletedTasks.length === 0) return tasks
    const map = new Map<string, Task>()
    tasks.forEach((t) => map.set(t.id, t))
    extraCompletedTasks.forEach((t) => map.set(t.id, t))
    return Array.from(map.values())
  }, [tasks, extraCompletedTasks])

  // Se o utilizador não for gestor, garante que apenas vê tarefas atribuídas a si
  const safeTasks = useMemo(() => {
    if (isManager) return combinedTasks
    const profileForMatch = { id: userId, role }
    return combinedTasks.filter((t) => isTaskAssignedToUser(t, profileForMatch))
  }, [combinedTasks, isManager, role, userId])

  const assetAreaMap = useMemo(() => new Map(assets.map((a) => [a.id, a.area || ''])), [assets])
  const assetTagMap = useMemo(() => new Map(assets.map((a) => [a.id, a.tag || ''])), [assets])
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>()
    assets.forEach((a) => { if (a.area && a.area.trim()) set.add(a.area.trim()) })
    safeTasks.forEach((t: any) => {
      const area = t.area || assetAreaMap.get(t.assetId)
      if (area && area.trim() && area !== '—') set.add(area.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [assets, safeTasks, assetAreaMap])

  const uniqueTags = useMemo(() => {
    const set = new Set<string>()
    const activeAreas = selectedAreas.length > 0
      ? selectedAreas.map((a) => a.trim().toLowerCase())
      : (areaFilter.trim() ? [areaFilter.trim().toLowerCase()] : [])

    assets.forEach((a) => {
      const aArea = (a.area || '').trim().toLowerCase()
      const aTag = (a.tag || '').trim()
      if (activeAreas.length === 0 || activeAreas.some((af) => aArea === af)) {
        if (aTag) set.add(aTag)
      }
    })

    safeTasks.forEach((t: any) => {
      const tArea = ((t as any).area || assetAreaMap.get(t.assetId) || '').trim().toLowerCase()
      const tag = (t as any).tag || assetTagMap.get(t.assetId)
      if (activeAreas.length === 0 || activeAreas.some((af) => tArea === af)) {
        if (tag && tag.trim() && tag !== '—') set.add(tag.trim())
      }
    })

    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [assets, safeTasks, selectedAreas, areaFilter, assetAreaMap, assetTagMap])

  const uniqueTechnicians = useMemo(() => {
    const isManagerUser = (u: any) => {
      if (!u) return false
      const r = String(u.role || '').toLowerCase().trim()
      if (r === 'manager' || r === 'admin' || r === 'gestor' || r === 'administrador') return true
      if (u.name?.toLowerCase().includes('garrido') || (u.email && u.email.toLowerCase().includes('garrido.rui'))) return true
      return false
    }

    if (!isManager) {
      const currentTech = users.find((u) => u.id === userId)
      if (currentTech && !isManagerUser(currentTech)) {
        return [[currentTech.abbreviation || currentTech.id, currentTech.abbreviation ? `${currentTech.abbreviation} - ${currentTech.name}` : currentTech.name] as [string, string]]
      }
      return []
    }
    const map = new Map<string, string>()
    users.forEach((u) => {
      if ((u as any).active !== false && !isManagerUser(u)) {
        const isTech = u.role === 'technician' || u.role === 'tecnico' || u.role === 'tech'
        if (isTech) {
          const val = u.abbreviation || u.id
          const label = u.abbreviation ? `${u.abbreviation} - ${u.name}` : u.name
          if (!map.has(val)) map.set(val, label)
        }
      }
    })
    safeTasks.forEach((t) => {
      if (t.assignedTo) {
        const raw = String(t.assignedTo).trim()
        if (raw === 'RG' || raw === 'nLqzaMwMu1OR4CKZzatjTlNBWt82' || raw === 'CUodZKziOwo128GLK66i') return
        const u = users.find((usr) => usr.id === raw || usr.abbreviation === raw)
        if (u) {
          if ((u as any).active !== false && !isManagerUser(u)) {
            const val = u.abbreviation || u.id
            const label = u.abbreviation ? `${u.abbreviation} - ${u.name}` : u.name
            map.set(val, label)
          }
        } else if (!raw.toLowerCase().includes('garrido') && !raw.toLowerCase().includes('admin')) {
          map.set(t.assignedTo, (t as any).assignedToText || t.assignedTo)
        }
      }
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt'))
  }, [safeTasks, users, isManager, userId])

  const searchIndex = useMemo(() => {
    const assetSearchMap = new Map(assets.map((a) => [a.id, `${a.name || ''} ${(a as any).tag || ''} ${(a as any).area || ''}`.toLowerCase()]))
    const userSearchMap = new Map(users.map((u) => [u.id, `${u.name || ''} ${(u as any).abbreviation || ''}`.toLowerCase()]))

    return safeTasks.map((t) => {
      const aSearch = t.assetId ? assetSearchMap.get(t.assetId) || '' : ''
      const uSearch = t.assignedTo ? userSearchMap.get(t.assignedTo) || '' : ''
      const text = `${t.title || ''} ${t.description || ''} ${(t as any).tag || ''} ${(t as any).area || ''} ${aSearch} ${uSearch}`.toLowerCase()
      return { task: t, text }
    })
  }, [safeTasks, assets, users])

  useEffect(() => { setCurrentPage(1) }, [search, selectedStatuses, selectedTIs, selectedAreas, selectedTags, selectedTechs, areaFilter, tagFilter, colF, pageSize])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const af = areaFilter.trim().toLowerCase()
    const tf = tagFilter.trim().toLowerCase()

    return searchIndex
      .filter(({ task: t, text }) => {
        if (!filterByExcelDate(t.createdAt || t.plannedStartDate || (t as any).completedAt, excelDateFilter)) return false
        if (!filterByExcelDate(t.createdAt || t.plannedStartDate, excelInicioFilter)) return false
        if (!filterByExcelDate(t.dueDate || t.completedAt, excelFimFilter)) return false

        // Filtro de Estado Multi-seleção
        if (selectedStatuses.length > 0 && selectedStatuses.length < 4) {
          if (!selectedStatuses.includes(t.status)) return false
        }

        const aArea = ((t as any).area || (t.assetId ? assetAreaMap.get(t.assetId) : '') || '').trim().toLowerCase()
        const aTag = ((t as any).tag || (t.assetId ? assetTagMap.get(t.assetId) : '') || '').trim().toLowerCase()

        // Filtro Multi-Seleção de Área
        if (selectedAreas.length > 0) {
          const isMatch = selectedAreas.some((areaCode) => {
            const cAf = areaCode.trim().toLowerCase()
            return aArea === cAf
          })
          if (!isMatch) return false
        } else if (af) {
          if (aArea !== af) return false
        }

        // Filtro Multi-Seleção de TAG
        if (selectedTags.length > 0) {
          const isMatch = selectedTags.some((tagCode) => {
            const cTf = tagCode.trim().toLowerCase()
            return aTag === cTf
          })
          if (!isMatch) return false
        } else if (tf) {
          if (aTag !== tf) return false
        }

        // Filtros por coluna na tabela
        if (colF.id) {
          const idStr = String(t.id || '').toLowerCase()
          if (!idStr.includes(colF.id.trim().toLowerCase())) return false
        }
        if (colF.data) {
          const dStr = (t.createdAt || t.plannedStartDate || '').toLowerCase()
          if (!dStr.includes(colF.data.trim().toLowerCase())) return false
        }
        if (colF.area && selectedAreas.length === 0) {
          const cAf = colF.area.trim().toLowerCase()
          if (cAf && aArea !== cAf) return false
        }
        if (colF.tag && selectedTags.length === 0) {
          const cTf = colF.tag.trim().toLowerCase()
          if (cTf && aTag !== cTf) return false
        }

        // Filtro Multi-Seleção de TI (Tipo de Intervenção)
        if (selectedTIs.length > 0) {
          const tTipo = String(t.tipo || '').toLowerCase()
          const tTi = String((t as any).ti || (t as any).tipoText || '').toLowerCase()
          const matchesAny = selectedTIs.some((tiCode) => {
            const tiFilter = tiCode.toLowerCase().trim()
            if (tiFilter === 'pi') return tTipo === 'pi' || tTi === 'pi'
            if (tiFilter === 'mc' || tiFilter === 'curativa') return tTipo === 'curativa' || tTipo === 'mc' || tTi === 'mc'
            if (tiFilter === 'mp' || tiFilter === 'preventiva') return tTipo === 'preventiva' || tTipo === 'mp' || tTi === 'mp'
            if (tiFilter === 'pm' || tiFilter === 'plano') return tTipo === 'plano' || tTipo === 'pm' || tTi === 'pm'
            if (tiFilter === 'mi') return tTipo === 'mi' || tTi === 'mi'
            if (tiFilter === 'stp' || tiFilter === 'pr') return tTipo === 'stp' || tTi === 'stp' || tTi === 'pr'
            if (tiFilter === 'ins' || tiFilter === 'inspecao') return tTipo === 'inspecao' || tTipo === 'ins' || tTi === 'ins'
            if (tiFilter === 'lub' || tiFilter === 'lubrificacao') return tTipo === 'lubrificacao' || tTipo === 'lub' || tTi === 'lub'
            if (tiFilter === 'cal' || tiFilter === 'calibracao') return tTipo === 'calibracao' || tTipo === 'cal' || tTi === 'cal'
            if (tiFilter === 'out' || tiFilter === 'outro') return tTipo === 'outro' || tTipo === 'out' || tTi === 'out'
            return tTipo === tiFilter || tTi === tiFilter
          })
          if (!matchesAny) return false
        } else if (colF.ti) {
          const tiFilter = colF.ti.trim().toLowerCase()
          const tTipo = String(t.tipo || '').toLowerCase()
          const tTi = String((t as any).ti || (t as any).tipoText || '').toLowerCase()
          let matches = false
          if (tiFilter === 'pi') matches = tTipo === 'pi' || tTi === 'pi'
          else if (tiFilter === 'mc' || tiFilter === 'curativa') matches = tTipo === 'curativa' || tTipo === 'mc' || tTi === 'mc'
          else if (tiFilter === 'mp' || tiFilter === 'preventiva') matches = tTipo === 'preventiva' || tTipo === 'mp' || tTi === 'mp'
          else if (tiFilter === 'pm' || tiFilter === 'plano') matches = tTipo === 'plano' || tTipo === 'pm' || tTi === 'pm'
          else if (tiFilter === 'mi') matches = tTipo === 'mi' || tTi === 'mi'
          else if (tiFilter === 'stp' || tiFilter === 'pr') matches = tTipo === 'stp' || tTi === 'stp' || tTi === 'pr'
          else if (tiFilter === 'ins' || tiFilter === 'inspecao') matches = tTipo === 'inspecao' || tTipo === 'ins' || tTi === 'ins'
          else if (tiFilter === 'lub' || tiFilter === 'lubrificacao') matches = tTipo === 'lubrificacao' || tTipo === 'lub' || tTi === 'lub'
          else if (tiFilter === 'cal' || tiFilter === 'calibracao') matches = tTipo === 'calibracao' || tTipo === 'cal' || tTi === 'cal'
          else if (tiFilter === 'out' || tiFilter === 'outro') matches = tTipo === 'outro' || tTipo === 'out' || tTi === 'out'
          else matches = tTipo === tiFilter || tTi === tiFilter
          if (!matches) return false
        }
        if (colF.avaria) {
          const avStr = String(t.title || '').toLowerCase()
          if (!avStr.includes(colF.avaria.trim().toLowerCase())) return false
        }
        // Filtro Multi-Seleção de Técnico
        if (selectedTechs.length > 0) {
          const isMatch = selectedTechs.some((tecFilterRaw) => matchesTechFilter(t, tecFilterRaw, users))
          if (!isMatch) return false
        } else if (colF.tecnico) {
          const isMatch = matchesTechFilter(t, colF.tecnico, users)
          if (!isMatch) return false
        }
        if (colF.obs) {
          const obsStr = String(t.description || '').toLowerCase()
          if (!obsStr.includes(colF.obs.trim().toLowerCase())) return false
        }

        if (q && !text.includes(q)) return false
        return true
      })
      .map(({ task }) => task)
  }, [searchIndex, selectedStatuses, selectedTIs, selectedAreas, selectedTags, selectedTechs, areaFilter, tagFilter, search, colF, assetAreaMap, assetTagMap, users, userName, excelDateFilter, excelInicioFilter, excelFimFilter])

  // Helper para converter qualquer data PT (DD-MM-YYYY) ou ISO (YYYY-MM-DD) em carimbo de data/hora comparável
  const parseDateToTs = (dStr?: string | null) => {
    if (!dStr) return 0
    const s = String(dStr).trim()
    const ptMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
    if (ptMatch) {
      return new Date(parseInt(ptMatch[3], 10), parseInt(ptMatch[2], 10) - 1, parseInt(ptMatch[1], 10)).getTime()
    }
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10)).getTime()
    }
    const d = new Date(s)
    return isNaN(d.getTime()) ? 0 : d.getTime()
  }

  // Prioridade de estado para ordenação por defeito:
  // Em Curso (1) -> Pendente (2) -> Concluída (3) -> Cancelada (4)
  const STATUS_DEFAULT_ORDER: Record<string, number> = {
    in_progress: 1,
    pending: 2,
    done: 3,
    cancelled: 4,
  }

  // Ordenação por defeito: Em Curso no topo, depois Pendentes, depois restantes.
  // Dentro de cada grupo, mantém a ordenação por data decrescente (mais recente primeiro).
  const defaultSortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (!isManager) {
        // Técnico vê as que lhe foram atribuídas estritamente ordenadas por data (mais recente primeiro)
        const dateA = parseDateToTs(a.plannedStartDate || a.createdAt || (a as any).completedAt)
        const dateB = parseDateToTs(b.plannedStartDate || b.createdAt || (b as any).completedAt)
        return dateB - dateA
      }
      const orderA = STATUS_DEFAULT_ORDER[a.status] ?? 99
      const orderB = STATUS_DEFAULT_ORDER[b.status] ?? 99
      if (orderA !== orderB) {
        return orderA - orderB
      }
      const dateA = parseDateToTs(a.createdAt || a.plannedStartDate || (a as any).completedAt)
      const dateB = parseDateToTs(b.createdAt || b.plannedStartDate || (b as any).completedAt)
      return dateB - dateA
    })
  }, [filtered, isManager])

  const parseTaskIdNum = (idStr: any): number => {
    const s = String(idStr || '')
    const match = s.match(/\d+/)
    return match ? parseInt(match[0], 10) : 0
  }

  // Ordenação por coluna (por defeito pela coluna ID)
  const { sorted: shown, sortKey, sortDir, toggleSort } = useTableSort<Task>(
    defaultSortedFiltered,
    {
      id: (t) => parseTaskIdNum((t as any).otNumber || t.id),
      data: (t) => parseDateToTs(t.createdAt || t.plannedStartDate || (t as any).completedAt),
      area: (t) => String((t as any).area || (t.assetId ? assetAreaMap.get(t.assetId) : '') || '').toLowerCase(),
      tag: (t) => String((t as any).tag || (t.assetId ? assetTagMap.get(t.assetId) : '') || '').toLowerCase(),
      ti: (t) => String(t.tipo || (t as any).ti || '').toLowerCase(),
      title: (t) => String(t.title || '').toLowerCase(),
      assignee: (t) => String(resolveTechInitials(t.assignedTo) || '').toLowerCase(),
      inicio: (t) => parseDateToTs(t.plannedStartDate || t.createdAt),
      fim: (t) => parseDateToTs(t.dueDate || t.completedAt),
      obs: (t) => String(t.observacoes || (t as any).causa || '').toLowerCase(),
      status: (t) => STATUS_LABELS[t.status] || t.status,
    },
    'id',
    'desc',
  )

  const effectivePageSize = (!isManager || pageSize === -1) ? (shown.length || 1) : pageSize
  const totalPages = Math.ceil(shown.length / effectivePageSize) || 1
  const currentShown = useMemo(() => {
    if (!isManager || pageSize === -1) return shown
    return shown.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  }, [shown, currentPage, pageSize, isManager])

  const statuses: TaskStatus[] = ['pending', 'in_progress', 'done', 'cancelled']
  const criticidades: TaskCriticidade[] = ['vermelho', 'amarelo', 'verde']
  const tipos: TipoTarefa[] = ['pi', 'curativa', 'mi', 'plano', 'stp', 'preventiva', 'mp', 'inspecao', 'lubrificacao', 'calibracao', 'outro']

  const importInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  async function handleExportXLS() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Ordens de Trabalho', { views: [{ showGridLines: true }] })

    sheet.mergeCells('A1:K1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = 'ORDENS DE TRABALHO (FR-MAN-09 / PL-MAN-01)'
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    sheet.getRow(1).height = 32

    const headers = ['ID OT', 'DATA', 'ÁREA', 'TAG / EQUIPAMENTO', 'TI', 'AVARIA / DESCRIÇÃO', 'TÉCNICO', 'INÍCIO', 'FIM', 'CAUSA / OBS', 'ESTADO']
    const headerRow = sheet.getRow(3)
    headerRow.values = headers
    headerRow.height = 26
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    shown.forEach((t) => {
      const area = (t as any).area || (t.assetId ? assetAreaMap.get(t.assetId) : '') || '—'
      const tag = (t as any).tag || (t.assetId ? assetTagMap.get(t.assetId) : '') || '—'
      const ti = (t.tipo || (t as any).ti || 'MC').toUpperCase()
      const tec = userName(t.assignedTo) || (t as any).assignedToText || '—'
      const dt = t.createdAt ? formatDate(t.createdAt) : '—'
      const inDate = t.plannedStartDate ? formatDate(t.plannedStartDate) : '—'
      const fmDate = t.dueDate || t.completedAt ? formatDate(t.dueDate || t.completedAt) : '—'
      const statusLabel = STATUS_LABELS[t.status] || t.status

      const row = sheet.addRow([
        (t as any).otNumber || t.id,
        dt,
        area,
        tag,
        ti,
        t.title,
        tec,
        inDate,
        fmDate,
        t.observacoes || (t as any).causa || '—',
        statusLabel,
      ])
      row.height = 20
    })

    sheet.columns = [
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 22 },
      { width: 10 },
      { width: 38 },
      { width: 20 },
      { width: 14 },
      { width: 14 },
      { width: 30 },
      { width: 16 },
    ]

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `Ordens_de_Trabalho_${new Date().toISOString().slice(0, 10)}.xlsx`
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.set('file', file)
    const result = await importMaintenancePlansAction(fd)
    setImporting(false)
    if (result.error) alert(result.error)
    else {
      alert(`Importação concluída com sucesso! (${result.created ?? 0} registos importados/atualizados)`)
      router.refresh()
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="w-full max-w-[1500px] mx-auto animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-industrial-blue dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span>{isManager ? dict.tasks.managerTasks : 'As minhas OTs'}</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {shown.length} OTs
              </span>
            </h1>
            {!isManager && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-industrial-blue dark:text-sky-300 font-extrabold text-xs border border-blue-200 dark:border-blue-800 shadow-2xs">
                <span>👤</span>
                <span>Técnico: {resolveTechLabel(userId)}</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-medium text-industrial-blue-light dark:text-slate-400 mt-1">
            {isManager ? 'Ordens de Trabalho ativas e planeadas da equipa' : 'Ordens de Trabalho ativas atribuídas'}
          </p>
        </div>

        {isManager && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={handleExportXLS}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
              title="Exportar lista de OTs filtradas para ficheiro Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
              title="Imprimir / Exportar lista de OTs para PDF"
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Imprimir (PDF)</span>
            </button>

            <button
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
              title="Importar ficheiro Excel de OTs ou Plano de Manutenção (FR-MAN-09 / PL-MAN-01)"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{importing ? 'A importar...' : 'Importar'}</span>
            </button>
            <input ref={importInputRef} type="file" accept=".xls,.xlsx,.xlsb" onChange={handleImportFile} className="hidden" />

            <button onClick={openCreate} className="h-10 px-4 bg-safety-orange hover:bg-safety-orange/90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-safety-orange/15 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
              <Plus size={16} className="stroke-[2.5] shrink-0" />
              <span>{dict.tasks.newTask}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filtros por estado, pesquisa e tamanho de página */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setSelectedStatuses(['pending', 'in_progress'])}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
              selectedStatuses.length === 2 && selectedStatuses.includes('pending') && selectedStatuses.includes('in_progress')
                ? 'bg-industrial-blue text-white shadow-industrial-blue/20 ring-2 ring-industrial-blue/30'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>⚡ Ativas</span>
          </button>

          <button
            onClick={() => setSelectedStatuses(['done', 'cancelled'])}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
              selectedStatuses.length === 2 && selectedStatuses.includes('done') && selectedStatuses.includes('cancelled')
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-slate-900/20 ring-2 ring-slate-900/30'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>📜 Histórico</span>
          </button>

          <button
            onClick={() => setSelectedStatuses(['pending', 'in_progress', 'done', 'cancelled'])}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
              selectedStatuses.length >= 4
                ? 'bg-slate-800 text-white shadow-slate-800/20 ring-2 ring-slate-800/30'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>📋 Todas</span>
          </button>

          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

          {statuses.map((s) => {
            const isSel = selectedStatuses.includes(s)
            return (
              <button
                key={s}
                onClick={() => {
                  if (isSel) {
                    if (selectedStatuses.length > 1) setSelectedStatuses(selectedStatuses.filter((st) => st !== s))
                  } else {
                    setSelectedStatuses([...selectedStatuses, s])
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  isSel
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>{isSel ? '✓' : '+'}</span>
                <span>{STATUS_LABELS[s]}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2.5 flex-nowrap overflow-x-auto py-1 w-full sm:w-auto">
          {/* Botão/Link Filtros */}
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
              filtersOpen || activeFiltersCount > 0
                ? 'bg-industrial-blue text-white border-industrial-blue shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                filtersOpen || activeFiltersCount > 0 ? 'bg-white text-industrial-blue' : 'bg-industrial-blue text-white'
              }`}>
                {activeFiltersCount}
              </span>
            )}
            {filtersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar OT..."
            className="input !text-xs !py-1.5 !px-3 w-36 sm:w-48 shrink-0 font-medium rounded-xl"
          />

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium shrink-0">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="select !text-xs !py-1 !px-2 font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs"
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

      {/* Vista em cartões — telemóvel e tablet (a tabela completa fica só para ecrãs md+) */}
      <div className="md:hidden space-y-2.5">
        {/* Filtros em Telemóvel (Área, TAG, TI, Técnico) — só visíveis se filtersOpen === true */}
        {filtersOpen && (
          <div className="bg-slate-50 dark:bg-slate-900/70 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Filtros
                </span>
                {activeFiltersCount > 0 && (
                  <span className="bg-industrial-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAreas([])
                    setSelectedTags([])
                    setSelectedTIs([])
                    setSelectedTechs([])
                    setAreaFilter('')
                    setTagFilter('')
                    setColF(emptyCol)
                  }}
                  className="text-[11px] text-red-500 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <X size={12} />
                  <span>Limpar filtros</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <MultiSelectPopoverFilter
                  label="Área"
                  options={uniqueAreas.map((a) => ({ value: a, label: a }))}
                  selectedValues={selectedAreas}
                  onChange={setSelectedAreas}
                  placeholder="Área (Todas)"
                  width="w-64 max-w-[85vw]"
                />
              </div>
              <div>
                <MultiSelectPopoverFilter
                  label="TAG"
                  options={uniqueTags.map((t) => ({ value: t, label: t }))}
                  selectedValues={selectedTags}
                  onChange={setSelectedTags}
                  placeholder="TAG (Todas)"
                  width="w-64 max-w-[85vw]"
                />
              </div>
              <div>
                <MultiSelectPopoverFilter
                  label="TI"
                  options={[
                    { value: 'PI', label: 'PI - Pedido Intervenção' },
                    { value: 'MC', label: 'MC - Curativa' },
                    { value: 'MP', label: 'MP - Preventiva' },
                    { value: 'PM', label: 'PM - Plano Manutenção' },
                    { value: 'MI', label: 'MI - Investimento' },
                    { value: 'STP', label: 'STP / PR - Projeto' },
                    { value: 'INS', label: 'INS - Inspeção' },
                    { value: 'LUB', label: 'LUB - Lubrificação' },
                    { value: 'CAL', label: 'CAL - Calibração' },
                    { value: 'OUT', label: 'OUT - Outro' },
                  ]}
                  selectedValues={selectedTIs}
                  onChange={setSelectedTIs}
                  placeholder="TI (Todos)"
                  width="w-64 max-w-[85vw]"
                />
              </div>
              <div>
                <MultiSelectPopoverFilter
                  label="Técnico"
                  options={uniqueTechnicians.map(([val, label]) => ({ value: val, label }))}
                  selectedValues={selectedTechs}
                  onChange={setSelectedTechs}
                  placeholder="Técnico (Todos)"
                  width="w-64 max-w-[85vw]"
                />
              </div>
            </div>
          </div>
        )}

        {currentShown.length === 0 ? (
          <div className="card px-5 py-12 text-center text-slate-400 border border-slate-200 dark:border-slate-800">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">{dict.tasks.empty}</p>
            <button
              type="button"
              onClick={() => {
                setAreaFilter('')
                setTagFilter('')
                setSelectedAreas([])
                setSelectedTags([])
                setSelectedTIs([])
                setSelectedTechs([])
                setColF(emptyCol)
              }}
              className="mt-3 text-xs font-bold text-[#2E86C1] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <X size={14} /> Limpar Todos os Filtros
            </button>
          </div>
        ) : (
          currentShown.map((t, idx) => {
            const asset = assets.find((a) => a.id === t.assetId)
            const formattedId = format3DigitId(t.id, idx)
            const tag = (asset as any)?.tag || asset?.name || (t as any).tag || '—'
            const area = (t as any).area || (asset as any)?.area || '—'
            const ids = (t.assignedToIds && t.assignedToIds.length > 0)
              ? t.assignedToIds
              : (t.assignedTo ? [t.assignedTo] : [])
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSummaryTask(t)}
                className="card w-full text-left border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 active:bg-blue-50/70 dark:active:bg-slate-800/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">{formattedId}</span>
                    <TipoBadge tipo={t.tipo} codeOnly={true} />
                    <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 truncate">
                      {t.assetId || (t as any).tag ? (
                        <Link
                          href={`/dashboard/assets/${encodeURIComponent(t.assetId || (t as any).tag)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-industrial-blue dark:text-blue-400 hover:text-safety-orange hover:underline font-bold"
                          title="Ver ficha do equipamento"
                        >
                          {tag}
                        </Link>
                      ) : (
                        tag
                      )} · {area}
                    </span>
                  </div>
                  <span className={`badge-${t.status} shrink-0`}>{STATUS_LABELS[t.status]}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{t.title}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                  <div className="flex flex-wrap gap-1">
                    {ids.length === 0 ? (
                      <span className="text-slate-400">Sem técnico</span>
                    ) : (
                      ids.map((idOrAbbr) => {
                        const u = users.find((usr) => usr.id === idOrAbbr || usr.abbreviation === idOrAbbr)
                        const initials = resolveTechInitials(idOrAbbr)
                        const fullName = resolveTechLabel(idOrAbbr)
                        const isExt = u?.isExternal
                        return (
                          <span
                            key={idOrAbbr}
                            title={fullName}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isExt ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-orange-100 text-orange-900 border border-orange-300'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isExt ? 'bg-blue-600' : 'bg-orange-600'} shrink-0`} />
                            {initials}
                          </span>
                        )
                      })
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs whitespace-nowrap">
                    <Clock className="h-3 w-3 text-industrial-blue dark:text-sky-400" />
                    <span>{getTaskDisplayDateTime(t)}</span>
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>

      <div className="hidden md:block card shadow-lg border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto custom-scrollbar min-h-[450px]">
          <table className="w-full text-xs min-w-[940px] table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                <SortableTh label="ID" sortableKey="id" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[55px] px-1.5 py-2" />
                <SortableTh label="DATA" sortableKey="data" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[85px] px-1.5 py-2" />
                <SortableTh label="ÁREA" sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[70px] px-1.5 py-2" />
                <SortableTh label="EQUIPAMENTO / TAG" sortableKey="tag" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[125px] px-1.5 py-2" />
                <SortableTh label="TI" sortableKey="ti" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[65px] px-1.5 py-2" />
                <SortableTh label="AVARIA / DESCRIÇÃO" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[150px] px-1.5 py-2" />
                <SortableTh label="TÉCNICOS" sortableKey="assignee" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[110px] px-1.5 py-2" />
                <SortableTh label="INÍCIO" sortableKey="inicio" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[85px] px-1.5 py-2" />
                <SortableTh label="FIM" sortableKey="fim" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[85px] px-1.5 py-2" />
                <SortableTh label="CAUSA / OBS" sortableKey="obs" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[110px] px-1.5 py-2" />
                <SortableTh label="ESTADO" sortableKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[85px] px-1.5 py-2" />
              </tr>
              {/* Linha de Filtro por Coluna (sempre visível, tal como em Plano de Manutenção / Inventário / Equipamentos) */}
              {(
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 p-1">
                  <td className="p-1 relative"><input value={colF.id} onChange={(e) => setCol('id', e.target.value)} placeholder="000..." className="input !text-[11px] !py-0.5 !px-1.5 w-full font-semibold" /></td>
                  <td className="p-1 relative"><ExcelColumnDateFilter values={excelDateFilter} onChange={setExcelDateFilter} /></td>
                  <td className="p-1 relative">
                    <MultiSelectPopoverFilter
                      label="Área"
                      options={uniqueAreas.map((a) => ({ value: a, label: a }))}
                      selectedValues={selectedAreas}
                      onChange={setSelectedAreas}
                      placeholder="Área (Todas)"
                      width="w-56"
                    />
                  </td>
                  <td className="p-1 relative">
                    <MultiSelectPopoverFilter
                      label="TAG"
                      options={uniqueTags.map((t) => ({ value: t, label: t }))}
                      selectedValues={selectedTags}
                      onChange={setSelectedTags}
                      placeholder="TAG (Todas)"
                      width="w-64"
                    />
                  </td>
                  <td className="p-1 relative">
                    <MultiSelectPopoverFilter
                      label="TI"
                      options={[
                        { value: 'PI', label: 'PI - Pedido Intervenção' },
                        { value: 'MC', label: 'MC - Curativa' },
                        { value: 'MP', label: 'MP - Preventiva' },
                        { value: 'PM', label: 'PM - Plano Manutenção' },
                        { value: 'MI', label: 'MI - Investimento' },
                        { value: 'STP', label: 'STP / PR - Projeto' },
                        { value: 'INS', label: 'INS - Inspeção' },
                        { value: 'LUB', label: 'LUB - Lubrificação' },
                        { value: 'CAL', label: 'CAL - Calibração' },
                        { value: 'OUT', label: 'OUT - Outro' },
                      ]}
                      selectedValues={selectedTIs}
                      onChange={setSelectedTIs}
                      placeholder="TI (Todos)"
                      width="w-56"
                    />
                  </td>
                  <td className="p-1 relative"><input value={colF.avaria} onChange={(e) => setCol('avaria', e.target.value)} placeholder="Avaria..." className="input !text-[11px] !py-0.5 !px-1.5 w-full font-semibold" /></td>
                  <td className="p-1 relative">
                    <MultiSelectPopoverFilter
                      label="Técnico"
                      options={uniqueTechnicians.map(([val, label]) => ({ value: val, label }))}
                      selectedValues={selectedTechs}
                      onChange={setSelectedTechs}
                      placeholder="Técnico (Todos)"
                      width="w-56"
                    />
                  </td>
                  <td className="p-1 relative"><ExcelColumnDateFilter values={excelInicioFilter} onChange={setExcelInicioFilter} /></td>
                  <td className="p-1 relative"><ExcelColumnDateFilter values={excelFimFilter} onChange={setExcelFimFilter} /></td>
                  <td className="p-1 relative"><input value={colF.obs} onChange={(e) => setCol('obs', e.target.value)} placeholder="Obs..." className="input !text-[11px] !py-0.5 !px-1.5 w-full font-semibold" /></td>
                  <td className="p-1 relative" />
                </tr>
              )}
            </thead>
            <tbody>
              {currentShown.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-12 text-center text-slate-400">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">{dict.tasks.empty}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setAreaFilter('')
                        setTagFilter('')
                        setSelectedAreas([])
                        setSelectedTags([])
                        setSelectedTIs([])
                        setSelectedTechs([])
                        setColF(emptyCol)
                      }}
                      className="mt-3 text-xs font-bold text-[#2E86C1] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <X size={14} /> Limpar Todos os Filtros
                    </button>
                  </td>
                </tr>
              ) : (
                currentShown.map((t, idx) => {
                  const asset = assets.find((a) => a.id === t.assetId)
                  const formattedId = format3DigitId(t.id, idx)
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSummaryTask(t)}
                      className="border-b border-slate-100 hover:bg-blue-50/70 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                      title="Clique para abrir o resumo da OT"
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200 group-hover:border-blue-400 group-hover:bg-blue-100/80 transition-colors">{formattedId}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {formatDate(t.createdAt || t.plannedStartDate)}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {(t as any).area || (asset as any)?.area || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const tagOrName = (asset as any)?.tag || asset?.name || (t as any).tag || '—'
                          const targetId = asset?.id || t.assetId || (t as any).tag
                          if (!targetId || tagOrName === '—') return <span>{tagOrName}</span>
                          return (
                            <Link
                              href={`/dashboard/assets/${encodeURIComponent(targetId)}`}
                              className="text-industrial-blue dark:text-blue-400 hover:text-safety-orange dark:hover:text-safety-orange hover:underline font-bold transition-colors inline-flex items-center gap-1"
                              title={`Abrir página do equipamento ${tagOrName}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>{tagOrName}</span>
                            </Link>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <TipoBadge tipo={t.tipo} codeOnly={true} />
                      </td>
                      <td className="px-3 py-2.5 text-slate-900 font-semibold max-w-[280px]">
                        <span className="group-hover:text-industrial-blue group-hover:underline transition-colors">
                          {t.title}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-800 font-semibold whitespace-nowrap">
                        {(() => {
                          const ids = (t.assignedToIds && t.assignedToIds.length > 0)
                            ? t.assignedToIds
                            : (t.assignedTo ? [t.assignedTo] : [])

                          if (ids.length === 0) return '—'

                          return (
                            <div className="flex flex-wrap gap-1">
                              {ids.map((idOrAbbr) => {
                                const u = users.find((usr) => usr.id === idOrAbbr || usr.abbreviation === idOrAbbr)
                                const initials = resolveTechInitials(idOrAbbr)
                                const fullName = resolveTechLabel(idOrAbbr)
                                const isExt = u?.isExternal
                                return (
                                  <span
                                    key={idOrAbbr}
                                    title={fullName}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                      isExt
                                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                        : 'bg-orange-100 text-orange-900 border border-orange-300'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${isExt ? 'bg-blue-600' : 'bg-orange-600'} shrink-0`} />
                                    {initials}
                                  </span>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                        {t.plannedStartDate ? formatDate(t.plannedStartDate) : '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                        {t.completedAt ? formatDate(t.completedAt) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 max-w-[200px]">
                        <span className="line-clamp-2" title={t.description ?? ''}>{t.description || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`badge-${t.status}`}>
                          {STATUS_LABELS[t.status]}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

        {isManager && totalPages > 1 && pageSize !== -1 && (
          <div className="hidden md:flex items-center justify-between border-t border-gray-100 dark:border-slate-800 px-4 py-3 bg-gray-50/50 dark:bg-slate-900/50">
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

      {/* Modal único para Criar ou Editar OT. Havia aqui uma segunda instância aberta em
          `showForm && !editing`, que ao criar uma OT nova abria empilhada com esta — dois
          formulários com os mesmos campos ao mesmo tempo — e que no sucesso não fechava a
          janela, dando a impressão de que a gravação não tinha feito nada. */}
      <CreateTaskModal
        isOpen={showForm}
        editingTask={editing}
        onClose={closeModal}
        initialAssetId={assetId}
        assets={assets}
        users={users}
        stockRefs={stockRefs}
        isManager={isManager}
        deleteAction={deleteTaskAction}
        onSuccess={() => {
          closeModal()
          router.refresh()
        }}
      />

      {/* Modal de Resumo Rápido de Execução da OT para o Técnico */}
      {summaryTask && (
        <TaskSummaryModal
          task={summaryTask}
          onClose={() => setSummaryTask(null)}
          onStatusChanged={(id, newStatus) => {
            handleStatusChange(id, newStatus)
            setSummaryTask((prev) => prev ? { ...prev, status: newStatus } : null)
          }}
          onOpenFullEdit={isManager ? (t) => {
            setSummaryTask(null)
            openEdit(t)
          } : undefined}
          isManager={isManager}
          resolveTechInitials={resolveTechInitials}
          resolveTechLabel={resolveTechLabel}
          assetTag={(assets.find((a) => a.id === summaryTask.assetId) as any)?.tag || (summaryTask as any).tag}
          assetName={assets.find((a) => a.id === summaryTask.assetId)?.name}
          area={(summaryTask as any).area || (assets.find((a) => a.id === summaryTask.assetId) as any)?.area}
        />
      )}
    </div>
  )
}
