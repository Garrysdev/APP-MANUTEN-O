'use client'

import { useState, useEffect, useTransition, useId, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ExcelJS from 'exceljs'
import {
  Plus, Pencil, Trash2, ClipboardList, X, Play, CheckCircle2,
  ShieldAlert, Package, CalendarClock, Building2, Scale, Eye,
  FileSpreadsheet, Printer, Upload,
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
  loadPlanTaskRefsAction, loadStockRefsAction, type StockMaterialRef,
} from './actions'
import ExcelDateFilter, { ExcelColumnDateFilter, ExcelDateFilterValues, DEFAULT_EXCEL_DATE_FILTER, filterByExcelDate } from '@/components/ui/ExcelDateFilter'
import { createMaintenancePlanAction, importMaintenancePlansAction } from '../maintenance-plan/actions'
import CreateTaskModal from '@/components/modals/CreateTaskModal'
import MultiSelectPopoverFilter from '@/components/ui/MultiSelectPopoverFilter'

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
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>(() => {
    const pStatus = searchParams.get('status')
    if (pStatus) {
      const list = pStatus.split(',').map((s) => s.trim() as TaskStatus).filter(Boolean)
      if (list.length > 0) return list
    }
    return [] // DEFAULT: Mostrar todas as OTs por omissão
  })
  const [selectedTIs, setSelectedTIs] = useState<string[]>([])
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTechs, setSelectedTechs] = useState<string[]>([])
  const [statusPending, startStatusTransition] = useTransition()

  useEffect(() => {
    const pStatus = searchParams.get('status')
    if (pStatus) {
      const list = pStatus.split(',').map((s) => s.trim() as TaskStatus).filter(Boolean)
      if (list.length > 0) setSelectedStatuses(list)
    }
  }, [searchParams])

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

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, (u as any).abbreviation || u.name])), [users])

  const assetName = (id?: string | null) => (id ? assetMap.get(id) ?? '—' : '—')
  const userName = (id?: string | null) => (id ? userMap.get(id) ?? id ?? '—' : '—')

  const assetAreaMap = useMemo(() => new Map(assets.map((a) => [a.id, a.area || ''])), [assets])
  const assetTagMap = useMemo(() => new Map(assets.map((a) => [a.id, a.tag || ''])), [assets])
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>()
    assets.forEach((a) => { if (a.area && a.area.trim()) set.add(a.area.trim()) })
    tasks.forEach((t: any) => {
      const area = t.area || assetAreaMap.get(t.assetId)
      if (area && area.trim() && area !== '—') set.add(area.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [assets, tasks, assetAreaMap])

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

    tasks.forEach((t: any) => {
      const tArea = ((t as any).area || assetAreaMap.get(t.assetId) || '').trim().toLowerCase()
      const tag = (t as any).tag || assetTagMap.get(t.assetId)
      if (activeAreas.length === 0 || activeAreas.some((af) => tArea === af)) {
        if (tag && tag.trim() && tag !== '—') set.add(tag.trim())
      }
    })

    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [assets, tasks, selectedAreas, areaFilter, assetAreaMap, assetTagMap])

  const uniqueTechnicians = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach((u) => {
      if ((u as any).active !== false) {
        const isTech = u.role === 'technician' || u.role === 'tecnico' || u.role === 'tech'
        if (isTech) {
          const val = u.abbreviation || u.id
          const label = u.abbreviation ? `${u.abbreviation} - ${u.name}` : u.name
          if (!map.has(val)) map.set(val, label)
        }
      }
    })
    tasks.forEach((t) => {
      if (t.assignedTo) {
        const u = users.find((usr) => usr.id === t.assignedTo || usr.abbreviation === t.assignedTo)
        if (u) {
          if ((u as any).active !== false) {
            const val = u.abbreviation || u.id
            const label = u.abbreviation ? `${u.abbreviation} - ${u.name}` : u.name
            map.set(val, label)
          }
        } else {
          map.set(t.assignedTo, (t as any).assignedToText || t.assignedTo)
        }
      }
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt'))
  }, [tasks, users])

  const searchIndex = useMemo(() => {
    const assetSearchMap = new Map(assets.map((a) => [a.id, `${a.name || ''} ${(a as any).tag || ''} ${(a as any).area || ''}`.toLowerCase()]))
    const userSearchMap = new Map(users.map((u) => [u.id, `${u.name || ''} ${(u as any).abbreviation || ''}`.toLowerCase()]))

    return tasks.map((t) => {
      const aSearch = t.assetId ? assetSearchMap.get(t.assetId) || '' : ''
      const uSearch = t.assignedTo ? userSearchMap.get(t.assignedTo) || '' : ''
      const text = `${t.title || ''} ${t.description || ''} ${(t as any).tag || ''} ${(t as any).area || ''} ${aSearch} ${uSearch}`.toLowerCase()
      return { task: t, text }
    })
  }, [tasks, assets, users])

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
          const assignedId = String(t.assignedTo || '').toLowerCase()
          const assignedText = String((t as any).assignedToText || '').toLowerCase()
          const displayUser = String(userName(t.assignedTo) || '').toLowerCase()
          const assignedIds = (t.assignedToIds || []).map((x) => String(x).toLowerCase())

          const matchesTech = selectedTechs.some((tecFilterRaw) => {
            const tecFilter = tecFilterRaw.trim().toLowerCase()
            if (assignedId === tecFilter || assignedText === tecFilter || displayUser.includes(tecFilter) || assignedIds.includes(tecFilter)) {
              return true
            }
            const userObj = users.find(u => 
              u.id.toLowerCase() === tecFilter || 
              (u.abbreviation && u.abbreviation.toLowerCase() === tecFilter) || 
              u.name.toLowerCase() === tecFilter
            )
            if (userObj) {
              if (assignedIds.includes(userObj.id.toLowerCase()) || (userObj.abbreviation && assignedIds.includes(userObj.abbreviation.toLowerCase()))) {
                return true
              }
              if (assignedId === userObj.id.toLowerCase() || (userObj.abbreviation && assignedId === userObj.abbreviation.toLowerCase()) || displayUser.includes(userObj.name.toLowerCase())) {
                return true
              }
            }
            return false
          })
          if (!matchesTech) return false
        } else if (colF.tecnico) {
          const tecFilter = colF.tecnico.trim().toLowerCase()
          const assignedId = String(t.assignedTo || '').toLowerCase()
          const assignedText = String((t as any).assignedToText || '').toLowerCase()
          const displayUser = String(userName(t.assignedTo) || '').toLowerCase()
          const assignedIds = (t.assignedToIds || []).map((x) => String(x).toLowerCase())

          const userObj = users.find(u => 
            u.id.toLowerCase() === tecFilter || 
            (u.abbreviation && u.abbreviation.toLowerCase() === tecFilter) || 
            u.name.toLowerCase() === tecFilter ||
            u.name.toLowerCase().includes(tecFilter)
          )

          let isMatch = false
          if (assignedId.includes(tecFilter) || assignedText.includes(tecFilter) || displayUser.includes(tecFilter) || assignedIds.some((id) => id.includes(tecFilter))) {
            isMatch = true
          } else if (userObj && (assignedIds.includes(userObj.id.toLowerCase()) || (userObj.abbreviation && assignedIds.includes(userObj.abbreviation.toLowerCase())))) {
            isMatch = true
          } else if (userObj) {
            if (
              assignedId === userObj.id.toLowerCase() ||
              (userObj.abbreviation && assignedId === userObj.abbreviation.toLowerCase()) ||
              displayUser.includes(userObj.name.toLowerCase())
            ) {
              isMatch = true
            }
          }
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

  // Ordenação por coluna
  const { sorted: shown, sortKey, sortDir, toggleSort } = useTableSort<Task>(
    filtered,
    {
      id: (t) => String((t as any).otNumber || t.id).toLowerCase(),
      data: (t) => parseDateToTs(t.createdAt || t.plannedStartDate || (t as any).completedAt),
      area: (t) => String((t as any).area || (t.assetId ? assetAreaMap.get(t.assetId) : '') || '').toLowerCase(),
      tag: (t) => String((t as any).tag || (t.assetId ? assetTagMap.get(t.assetId) : '') || '').toLowerCase(),
      ti: (t) => String(t.tipo || (t as any).ti || '').toLowerCase(),
      title: (t) => String(t.title || '').toLowerCase(),
      assignee: (t) => String(userName(t.assignedTo) || '').toLowerCase(),
      inicio: (t) => parseDateToTs(t.plannedStartDate || t.createdAt),
      fim: (t) => parseDateToTs(t.dueDate || t.completedAt),
      obs: (t) => String(t.observacoes || (t as any).causa || '').toLowerCase(),
      status: (t) => STATUS_LABELS[t.status] || t.status,
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
          <h1 className="text-xl sm:text-2xl font-extrabold text-industrial-blue dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>{isManager ? dict.tasks.managerTasks : dict.tasks.myTasks}</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {shown.length} / {tasks.length}
            </span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-industrial-blue-light dark:text-slate-400 mt-1">
            Ordens de Trabalho ativas e pendentes da equipa
          </p>
        </div>

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
      </div>

      {/* Filtros por estado, pesquisa e tamanho de página */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setSelectedStatuses(['pending', 'in_progress'])}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
              selectedStatuses.length === 2 && selectedStatuses.includes('pending') && selectedStatuses.includes('in_progress')
                ? 'bg-industrial-blue text-white shadow-industrial-blue/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>⚡ Ativas (Pendente + Em Curso)</span>
          </button>

          <button
            onClick={() => setSelectedStatuses(['done', 'cancelled'])}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
              selectedStatuses.length === 2 && selectedStatuses.includes('done') && selectedStatuses.includes('cancelled')
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-slate-900/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>📜 Histórico (Concluídas + Canceladas)</span>
          </button>

          <button
            onClick={() => setSelectedStatuses(['pending', 'in_progress', 'done', 'cancelled'])}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
              selectedStatuses.length >= 4
                ? 'bg-industrial-blue text-white shadow-industrial-blue/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>📋 Todas as OTs</span>
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
          {/* Seletor Multi-Seleção de Área */}
          <div className="shrink-0 min-w-[180px] max-w-[240px]">
            <MultiSelectPopoverFilter
              label="Área"
              options={uniqueAreas.map((area) => ({ value: area, label: `Área: ${area}` }))}
              selectedValues={selectedAreas}
              onChange={setSelectedAreas}
              placeholder="-- Área: Todas --"
              width="w-64"
            />
          </div>

          {/* Seletor Multi-Seleção de TAG */}
          <div className="shrink-0 min-w-[180px] max-w-[240px]">
            <MultiSelectPopoverFilter
              label="TAG"
              options={uniqueTags.map((tag) => ({ value: tag, label: `TAG: ${tag}` }))}
              selectedValues={selectedTags}
              onChange={setSelectedTags}
              placeholder="-- TAG: Todas --"
              width="w-64"
            />
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar OT..."
            className="input !text-xs !py-1.5 !px-3 w-40 sm:w-48 shrink-0 font-medium rounded-xl"
          />

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium shrink-0">
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

      <div className="card shadow-lg border border-slate-200 dark:border-slate-800">
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
              {/* Linha de Filtro por Coluna */}
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
                      { value: 'PM', label: 'PM - Plano' },
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
                      onClick={() => router.push(`/dashboard/tasks/${t.id}`)}
                      className="border-b border-slate-100 hover:bg-blue-50/70 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                      title="Clique para abrir e ver/editar a OT"
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
                      <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {(asset as any)?.tag || asset?.name || (t as any).tag || '—'}
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
                                const label = u ? (u.abbreviation || u.name) : (userName(idOrAbbr) !== '—' ? userName(idOrAbbr) : idOrAbbr)
                                const isExt = u?.isExternal
                                return (
                                  <span
                                    key={idOrAbbr}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                      isExt
                                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                        : 'bg-orange-100 text-orange-900 border border-orange-300'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${isExt ? 'bg-blue-600' : 'bg-orange-600'} shrink-0`} />
                                    {label}
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

      {/* Unified Nova OT Modal Component */}
      <CreateTaskModal
        isOpen={showForm && !editing}
        onClose={closeModal}
        initialAssetId={assetId}
        assets={assets}
        users={users}
        stockRefs={stockRefs}
        isManager={isManager}
        onSuccess={() => {
          router.refresh()
        }}
      />

      {/* Modal unificado para Criar ou Editar OT com registo de auditoria ERP */}
      <CreateTaskModal
        isOpen={showForm}
        editingTask={editing}
        onClose={closeModal}
        assets={assets}
        users={users}
        stockRefs={stockRefs}
        isManager={isManager}
        onSuccess={() => {
          closeModal()
          router.refresh()
        }}
      />
    </div>
  )
}
