'use client'

import { useState, useEffect, useTransition, useId, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { createMaintenancePlanAction } from '../maintenance-plan/actions'
import CreateTaskModal from '@/components/modals/CreateTaskModal'

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
    const paramStatus = searchParams.get('status')
    if (paramStatus) {
      const list = paramStatus.split(',').map((s) => s.trim()) as TaskStatus[]
      const valid = list.filter((s) => ['pending', 'in_progress', 'done', 'cancelled'].includes(s))
      if (valid.length > 0) return valid
    }
    return ['pending', 'in_progress', 'done', 'cancelled'] // Padrão: Mostrar TODAS as OTs (Ativas + Histórico)
  })
  const [selectedTis, setSelectedTis] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'open' | TaskStatus>('all')
  const [statusPending, startStatusTransition] = useTransition()

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
    const af = areaFilter.trim().toLowerCase()
    assets.forEach((a) => {
      const aArea = (a.area || '').trim().toLowerCase()
      const aTag = (a.tag || '').trim()
      if (!af || aArea === af || aArea.startsWith(af) || aTag.toLowerCase().startsWith(af)) {
        if (aTag) set.add(aTag)
      }
    })
    tasks.forEach((t: any) => {
      const tArea = ((t as any).area || assetAreaMap.get(t.assetId) || '').trim().toLowerCase()
      const tag = (t as any).tag || assetTagMap.get(t.assetId)
      if (!af || tArea === af || tArea.startsWith(af) || (tag && tag.toLowerCase().startsWith(af))) {
        if (tag && tag.trim() && tag !== '—') set.add(tag.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [assets, tasks, areaFilter, assetAreaMap, assetTagMap])

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

  useEffect(() => { setCurrentPage(1) }, [search, filter, selectedStatuses, selectedTis, areaFilter, tagFilter, colF, pageSize])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const af = areaFilter.trim().toLowerCase()
    const tf = tagFilter.trim().toLowerCase()

    return searchIndex
      .filter(({ task: t, text }) => {
        if (!filterByExcelDate(t.createdAt || t.plannedStartDate || (t as any).completedAt, excelDateFilter)) return false
        if (!filterByExcelDate(t.createdAt || t.plannedStartDate, excelInicioFilter)) return false
        if (!filterByExcelDate(t.dueDate || t.completedAt, excelFimFilter)) return false

        // Filtro Multi-Seleção de Estados
        if (selectedStatuses.length > 0 && selectedStatuses.length < 4) {
          if (!selectedStatuses.includes(t.status)) return false
        } else if (filter === 'open' && (t.status === 'done' || t.status === 'cancelled')) {
          return false
        } else if (filter !== 'open' && filter !== 'all' && t.status !== filter) {
          return false
        }

        // Filtro Multi-Seleção de TIs (Tipos de Intervenção)
        if (selectedTis.length > 0) {
          const tTipo = String(t.tipo || '').toLowerCase()
          const tTi = String((t as any).ti || (t as any).tipoText || '').toLowerCase()
          const matchesAnyTi = selectedTis.some((tiFilter) => {
            const tf = tiFilter.toLowerCase()
            if (tf === 'pi') return tTipo === 'pi' || tTi === 'pi'
            if (tf === 'mc' || tf === 'curativa') return tTipo === 'curativa' || tTipo === 'mc' || tTi === 'mc'
            if (tf === 'mp' || tf === 'preventiva') return tTipo === 'preventiva' || tTipo === 'mp' || tTi === 'mp'
            if (tf === 'pm' || tf === 'plano') return tTipo === 'plano' || tTipo === 'pm' || tTi === 'pm'
            if (tf === 'mi') return tTipo === 'mi' || tTi === 'mi'
            if (tf === 'stp' || tf === 'pr') return tTipo === 'stp' || tTi === 'stp' || tTi === 'pr'
            if (tf === 'ins' || tf === 'inspecao') return tTipo === 'inspecao' || tTipo === 'ins' || tTi === 'ins'
            if (tf === 'lub' || tf === 'lubrificacao') return tTipo === 'lubrificacao' || tTipo === 'lub' || tTi === 'lub'
            if (tf === 'cal' || tf === 'calibracao') return tTipo === 'calibracao' || tTipo === 'cal' || tTi === 'cal'
            if (tf === 'out' || tf === 'outro') return tTipo === 'outro' || tTipo === 'out' || tTi === 'out'
            return tTipo === tf || tTi === tf
          })
          if (!matchesAnyTi) return false
        }

        const aArea = ((t as any).area || (t.assetId ? assetAreaMap.get(t.assetId) : '') || '').trim().toLowerCase()
        const aTag = ((t as any).tag || (t.assetId ? assetTagMap.get(t.assetId) : '') || '').trim().toLowerCase()

        // Filtro de Área no topo
        if (af) {
          if (aArea !== af && !aArea.startsWith(af)) return false
        }

        // Filtro de TAG no topo
        if (tf) {
          if (aTag !== tf && !aTag.startsWith(tf)) return false
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
        if (colF.area) {
          const cAf = colF.area.trim().toLowerCase()
          if (cAf && aArea !== cAf && !aArea.startsWith(cAf)) return false
        }
        if (colF.tag) {
          const cTf = colF.tag.trim().toLowerCase()
          if (cTf && aTag !== cTf && !aTag.startsWith(cTf)) return false
        }
        if (colF.ti) {
          const tiFilter = colF.ti.trim().toLowerCase()
          const tTipo = String(t.tipo || '').toLowerCase()
          const tTi = String((t as any).ti || (t as any).tipoText || '').toLowerCase()
          let matches = false

          if (tiFilter === 'pi') {
            matches = tTipo === 'pi' || tTi === 'pi'
          } else if (tiFilter === 'mc' || tiFilter === 'curativa') {
            matches = tTipo === 'curativa' || tTipo === 'mc' || tTi === 'mc'
          } else if (tiFilter === 'mp' || tiFilter === 'preventiva') {
            matches = tTipo === 'preventiva' || tTipo === 'mp' || tTi === 'mp'
          } else if (tiFilter === 'pm' || tiFilter === 'plano') {
            matches = tTipo === 'plano' || tTipo === 'pm' || tTi === 'pm'
          } else if (tiFilter === 'mi') {
            matches = tTipo === 'mi' || tTi === 'mi'
          } else if (tiFilter === 'stp' || tiFilter === 'pr') {
            matches = tTipo === 'stp' || tTi === 'stp' || tTi === 'pr'
          } else if (tiFilter === 'ins' || tiFilter === 'inspecao') {
            matches = tTipo === 'inspecao' || tTipo === 'ins' || tTi === 'ins'
          } else if (tiFilter === 'lub' || tiFilter === 'lubrificacao') {
            matches = tTipo === 'lubrificacao' || tTipo === 'lub' || tTi === 'lub'
          } else if (tiFilter === 'cal' || tiFilter === 'calibracao') {
            matches = tTipo === 'calibracao' || tTipo === 'cal' || tTi === 'cal'
          } else if (tiFilter === 'out' || tiFilter === 'outro') {
            matches = tTipo === 'outro' || tTipo === 'out' || tTi === 'out'
          } else {
            matches = tTipo === tiFilter || tTi === tiFilter
          }

          if (!matches) return false
        }
        if (colF.avaria) {
          const avStr = String(t.title || '').toLowerCase()
          if (!avStr.includes(colF.avaria.trim().toLowerCase())) return false
        }
        if (colF.tecnico) {
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
  }, [searchIndex, filter, selectedStatuses, selectedTis, areaFilter, tagFilter, search, colF, assetAreaMap, assetTagMap, users, userName, excelDateFilter, excelInicioFilter, excelFimFilter])

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
  const tipos: TipoTarefa[] = ['pi', 'curativa', 'mi', 'plano', 'stp', 'preventiva', 'mp', 'inspecao', 'lubrificacao', 'calibracao', 'outro']

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
        <button onClick={openCreate} className="shrink-0 h-10 px-4 bg-safety-orange hover:bg-safety-orange/90 text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-safety-orange/15 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
          <Plus size={16} className="stroke-[2.5] shrink-0" />
          <span>{dict.tasks.newTask}</span>
        </button>
      </div>

      {/* Filtros por estado, pesquisa e tamanho de página */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      {/* Filtros por Estado (Multi-Seleção) */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Estados:</span>
          
          {/* Botão Principal: Todas as OTs (Ativas + Histórico) */}
          <button
            type="button"
            onClick={() => {
              setFilter('all')
              setSelectedStatuses(['pending', 'in_progress', 'done', 'cancelled'])
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
              selectedStatuses.length === 4
                ? 'bg-industrial-blue text-white ring-2 ring-industrial-blue/30 font-black'
                : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            📋 Todas as OTs ({tasks.length})
          </button>

          {/* Botão Atalho: Ativas (Pendente + Em Curso) */}
          <button
            type="button"
            onClick={() => {
              setFilter('all')
              setSelectedStatuses(['pending', 'in_progress'])
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
              selectedStatuses.includes('pending') && selectedStatuses.includes('in_progress') && !selectedStatuses.includes('done') && !selectedStatuses.includes('cancelled')
                ? 'bg-amber-600 text-white ring-2 ring-amber-600/30'
                : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>⚡ Só Ativas (Pendente + Em Curso)</span>
          </button>

          {/* Botões individuais de Estado com Toggle */}
          {statuses.map((s) => {
            const isActive = selectedStatuses.includes(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setFilter('all')
                  if (isActive) {
                    if (selectedStatuses.length > 1) {
                      setSelectedStatuses(selectedStatuses.filter((x) => x !== s))
                    }
                  } else {
                    setSelectedStatuses([...selectedStatuses, s])
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? s === 'done'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/30'
                      : s === 'pending'
                      ? 'bg-slate-700 text-white ring-2 ring-slate-700/30'
                      : s === 'in_progress'
                      ? 'bg-amber-600 text-white ring-2 ring-amber-600/30'
                      : 'bg-red-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-slate-400'}`} />
                <span>{s === 'done' ? 'Concluídas (Histórico)' : STATUS_LABELS[s]}</span>
              </button>
            )
          })}
        </div>

        {/* Filtros por Tipo de Intervenção (TI — Multi-Seleção) */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-200/60 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Filtro TI:</span>
          
          <button
            type="button"
            onClick={() => setSelectedTis([])}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              selectedTis.length === 0
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            Todos os TIs
          </button>

          {[
            { id: 'PI', label: 'PI - Pedido Intervenção', color: 'bg-red-600 text-white border-red-600' },
            { id: 'MC', label: 'MC - Curativa', color: 'bg-amber-600 text-white border-amber-600' },
            { id: 'MP', label: 'MP - Preventiva', color: 'bg-purple-600 text-white border-purple-600' },
            { id: 'PM', label: 'PM - Plano', color: 'bg-blue-600 text-white border-blue-600' },
            { id: 'STP', label: 'STP - Set-up / Preparação', color: 'bg-lime-600 text-white border-lime-600' },
            { id: 'MI', label: 'MI - Investimento', color: 'bg-indigo-600 text-white border-indigo-600' },
            { id: 'INS', label: 'INS - Inspeção', color: 'bg-teal-600 text-white border-teal-600' },
            { id: 'LUB', label: 'LUB - Lubrificação', color: 'bg-cyan-600 text-white border-cyan-600' },
            { id: 'CAL', label: 'CAL - Calibração', color: 'bg-emerald-600 text-white border-emerald-600' },
            { id: 'OUT', label: 'OUT - Outro', color: 'bg-slate-600 text-white border-slate-600' },
          ].map((item) => {
            const isSelected = selectedTis.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSelectedTis(selectedTis.filter((x) => x !== item.id))
                  } else {
                    setSelectedTis([...selectedTis, item.id])
                  }
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                  isSelected
                    ? `${item.color} shadow-sm ring-1 ring-offset-1`
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                {isSelected ? `✓ ${item.id}` : item.id}
              </button>
            )
          })}
        </div>
      </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Filtro por Área */}
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

          {/* Seletor de Filtro por TAG */}
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

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar OT..."
            className="input text-xs py-1.5 px-3 w-40 sm:w-48"
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

      <div className="card overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs min-w-[940px] table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                <SortableTh label="ID" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[55px] px-1.5 py-2" />
                <SortableTh label="DATA" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[75px] px-1.5 py-2" />
                <SortableTh label="ÁREA" sortableKey="asset" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[55px] px-1.5 py-2" />
                <SortableTh label="EQUIPAMENTO / TAG" sortableKey="asset" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[110px] px-1.5 py-2" />
                <SortableTh label="TI" sortableKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[50px] px-1.5 py-2" />
                <SortableTh label="AVARIA / DESCRIÇÃO" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[160px] px-1.5 py-2" />
                <SortableTh label="TÉCNICOS" sortableKey="assignee" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[100px] px-1.5 py-2" />
                <SortableTh label="INÍCIO" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[75px] px-1.5 py-2" />
                <SortableTh label="FIM" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[75px] px-1.5 py-2" />
                <SortableTh label="CAUSA / OBS" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[115px] px-1.5 py-2" />
                <SortableTh label="ESTADO" sortableKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[80px] px-1.5 py-2" />
                <th className="w-[90px] px-1.5 py-2 text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">AÇÕES</th>
              </tr>
              {/* Linha de Filtro por Coluna */}
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 p-1">
                <td className="p-1"><input value={colF.id} onChange={(e) => setCol('id', e.target.value)} placeholder="000..." className="input !text-[11px] !py-0.5 !px-1.5 w-full font-semibold" /></td>
                <td className="p-1 relative"><ExcelColumnDateFilter values={excelDateFilter} onChange={setExcelDateFilter} /></td>
                <td className="p-1">
                  <select
                    value={colF.area}
                    onChange={(e) => setCol('area', e.target.value)}
                    className="input !text-[11px] !py-0.5 !px-1 w-full font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="">Área (Todas)</option>
                    {uniqueAreas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <select
                    value={colF.tag}
                    onChange={(e) => setCol('tag', e.target.value)}
                    className="input !text-[11px] !py-0.5 !px-1 w-full font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="">TAG (Todas)</option>
                    {uniqueTags.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <select
                    value={colF.ti}
                    onChange={(e) => setCol('ti', e.target.value)}
                    className="input !text-[11px] !py-0.5 !px-1 w-full font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="">TI (Todos)</option>
                    <option value="MC">MC - Curativa</option>
                    <option value="MP">MP - Preventiva</option>
                    <option value="PM">PM - Plano</option>
                    <option value="PI">PI - Pedido Intervenção</option>
                    <option value="MI">MI - Investimento</option>
                    <option value="PR">PR - Projeto</option>
                    <option value="INS">INS - Inspeção</option>
                    <option value="LUB">LUB - Lubrificação</option>
                    <option value="CAL">CAL - Calibração</option>
                    <option value="OUT">OUT - Outro</option>
                  </select>
                </td>
                <td className="p-1"><input value={colF.avaria} onChange={(e) => setCol('avaria', e.target.value)} placeholder="Avaria..." className="input !text-[11px] !py-0.5 !px-1.5 w-full font-semibold" /></td>
                <td className="p-1">
                  <select
                    value={colF.tecnico}
                    onChange={(e) => setCol('tecnico', e.target.value)}
                    className="input !text-[11px] !py-0.5 !px-1 w-full font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="">Técnico (Todos)</option>
                    {uniqueTechnicians.map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1 relative"><ExcelColumnDateFilter values={excelInicioFilter} onChange={setExcelInicioFilter} /></td>
                <td className="p-1 relative"><ExcelColumnDateFilter values={excelFimFilter} onChange={setExcelFimFilter} /></td>
                <td className="p-1"><input value={colF.obs} onChange={(e) => setCol('obs', e.target.value)} placeholder="Obs..." className="input !text-[11px] !py-0.5 !px-1.5 w-full font-semibold" /></td>
                <td className="p-1" />
                <td className="p-1" />
              </tr>
            </thead>
            <tbody>
              {currentShown.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-5 py-12 text-center text-slate-400">
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
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200">{formattedId}</span>
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
                        <Link href={`/dashboard/tasks/${t.id}`} className="hover:text-safety-orange transition-colors underline-offset-2 hover:underline">
                          {t.title}
                        </Link>
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
