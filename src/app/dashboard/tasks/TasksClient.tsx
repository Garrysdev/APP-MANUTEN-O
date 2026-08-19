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
      if (!af || (a.area || '').trim().toLowerCase() === af || (a.area || '').trim().toLowerCase().includes(af)) {
        if (a.tag && a.tag.trim()) set.add(a.tag.trim())
      }
    })
    tasks.forEach((t: any) => {
      const tArea = ((t as any).area || assetAreaMap.get(t.assetId) || '').trim().toLowerCase()
      if (!af || tArea === af || tArea.includes(af)) {
        const tag = (t as any).tag || assetTagMap.get(t.assetId)
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

  useEffect(() => { setCurrentPage(1) }, [search, filter, areaFilter, tagFilter, colF, pageSize])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const af = areaFilter.trim().toLowerCase()
    const tf = tagFilter.trim().toLowerCase()

    return searchIndex
      .filter(({ task: t, text }) => {
        if (filter === 'open' && (t.status === 'done' || t.status === 'cancelled')) return false
        if (filter !== 'open' && filter !== 'all' && t.status !== filter) return false

        const aArea = ((t as any).area || (t.assetId ? assetAreaMap.get(t.assetId) : '') || '').trim().toLowerCase()
        const aTag = ((t as any).tag || (t.assetId ? assetTagMap.get(t.assetId) : '') || '').trim().toLowerCase()

        // Filtro de Área no topo
        if (af) {
          if (aArea !== af && !aArea.includes(af)) return false
        }

        // Filtro de TAG no topo
        if (tf) {
          if (aTag !== tf && !aTag.includes(tf)) return false
        }

        // Filtros por coluna na tabela
        if (colF.id) {
          const idStr = String(t.id || '').toLowerCase()
          if (!idStr.includes(colF.id.trim().toLowerCase())) return false
        }
        if (colF.data) {
          const dStr = (t.plannedStartDate || t.createdAt || '').toLowerCase()
          if (!dStr.includes(colF.data.trim().toLowerCase())) return false
        }
        if (colF.area) {
          const cAf = colF.area.trim().toLowerCase()
          if (cAf && aArea !== cAf && !aArea.includes(cAf)) return false
        }
        if (colF.tag) {
          const cTf = colF.tag.trim().toLowerCase()
          if (cTf && aTag !== cTf && !aTag.includes(cTf)) return false
        }
        if (colF.ti) {
          const tiFilter = colF.ti.trim().toLowerCase()
          const tTipo = String(t.tipo || '').toLowerCase()
          let matches = false
          if (tTipo === tiFilter) matches = true
          else if ((tiFilter === 'mc' || tiFilter === 'curativa') && (tTipo === 'curativa' || tTipo === 'mc')) matches = true
          else if ((tiFilter === 'mp' || tiFilter === 'preventiva') && (tTipo === 'preventiva' || tTipo === 'mp')) matches = true
          else if ((tiFilter === 'pm' || tiFilter === 'pi' || tiFilter === 'plano') && (tTipo === 'pi' || tTipo === 'pm' || tTipo === 'preventiva')) matches = true
          else if ((tiFilter === 'ins' || tiFilter === 'inspecao') && (tTipo === 'inspecao' || tTipo === 'ins')) matches = true
          else if ((tiFilter === 'lub' || tiFilter === 'lubrificacao') && (tTipo === 'lubrificacao' || tTipo === 'lub')) matches = true
          else if ((tiFilter === 'cal' || tiFilter === 'calibracao') && (tTipo === 'calibracao' || tTipo === 'cal')) matches = true
          else if ((tiFilter === 'out' || tiFilter === 'outro') && (tTipo === 'outro' || tTipo === 'out')) matches = true
          else if (tTipo.includes(tiFilter)) matches = true

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
  }, [searchIndex, filter, areaFilter, tagFilter, search, colF, assetAreaMap, assetTagMap, users, userName])

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
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
              filter === 'all' ? 'bg-industrial-blue text-white' : 'bg-white border border-outline text-industrial-blue-light hover:bg-slate-50 hover:text-industrial-blue'
            }`}
          >
            Todas as OTs
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                filter === s ? 'bg-industrial-blue text-white' : 'bg-white border border-outline text-industrial-blue-light hover:bg-slate-50 hover:text-industrial-blue'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
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

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px] table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider">
                <SortableTh label="ID" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[75px] px-2 py-2" />
                <SortableTh label="DATA" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[95px] px-2 py-2" />
                <SortableTh label="ÁREA" sortableKey="asset" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[80px] px-2 py-2" />
                <SortableTh label="EQUIPAMENTO / TAG" sortableKey="asset" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[140px] px-2 py-2" />
                <SortableTh label="TI" sortableKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[70px] px-2 py-2" />
                <SortableTh label="AVARIA / DESCRIÇÃO" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[240px] px-2 py-2" />
                <SortableTh label="TÉCNICOS" sortableKey="assignee" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[130px] px-2 py-2" />
                <SortableTh label="INÍCIO" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[90px] px-2 py-2" />
                <SortableTh label="FIM" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[90px] px-2 py-2" />
                <SortableTh label="CAUSA / OBS" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[160px] px-2 py-2" />
                <SortableTh label="ESTADO" sortableKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[95px] px-2 py-2" />
                <th className="w-[90px] px-2 py-2 text-right font-mono text-xs font-bold text-slate-700 uppercase tracking-wider">AÇÕES</th>
              </tr>
              {/* Linha de Filtro por Coluna */}
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 p-1">
                <td className="p-1"><input value={colF.id} onChange={(e) => setCol('id', e.target.value)} placeholder="000..." className="input !text-[11px] !py-0.5 !px-1.5 w-full font-semibold" /></td>
                <td className="p-1"><input value={colF.data} onChange={(e) => setCol('data', e.target.value)} placeholder="Data..." className="input !text-[11px] !py-0.5 !px-1.5 w-full font-semibold" /></td>
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
                <td className="p-1" />
                <td className="p-1" />
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
                        {t.plannedStartDate ? formatDate(t.plannedStartDate) : formatDate(t.createdAt)}
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
                          {t.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(t.id, 'in_progress')}
                                className="px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 rounded bg-blue-50 border border-blue-200 flex items-center gap-1 transition-colors"
                                title="Iniciar OT"
                              >
                                <Play className="h-3 w-3" /> Iniciar
                              </button>
                              <button
                                onClick={() => handleStatusChange(t.id, 'done')}
                                className="px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 rounded bg-emerald-50 border border-emerald-200 flex items-center gap-1 transition-colors"
                                title="Fechar OT"
                              >
                                <CheckCircle2 className="h-3 w-3" /> Fechar
                              </button>
                            </>
                          )}
                          {t.status === 'in_progress' && (
                            <button
                              onClick={() => handleStatusChange(t.id, 'done')}
                              className="px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 rounded bg-emerald-50 border border-emerald-200 flex items-center gap-1 transition-colors"
                              title="Fechar OT"
                            >
                              <CheckCircle2 className="h-3 w-3" /> Fechar
                            </button>
                          )}
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

      {/* Modal editar OT existente */}
      {showForm && editing && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-4 sm:pt-8 overflow-y-auto">
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="card relative w-full max-w-lg p-6 shadow-2xl my-auto sm:my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{dict.tasks.modalEdit}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="hidden" name="id" value={editing.id} />
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

              <div>
                <SearchableAssetSelect
                  value={assetId}
                  onChange={(val) => { setAssetId(val); setMaintenancePlanId('') }}
                  assets={assets}
                  required
                />
                {(() => {
                  const selAsset = assets.find((a) => a.id === assetId)
                  if (!selAsset) return null
                  return (
                    <>
                      <input type="hidden" name="tag" value={selAsset.tag ?? ''} />
                      <input type="hidden" name="area" value={selAsset.area ?? ''} />
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] font-semibold text-industrial-blue bg-blue-50 dark:bg-slate-800/80 p-2 rounded-lg border border-blue-100 dark:border-slate-700">
                        <span>📍 Área: <strong className="text-slate-900 dark:text-slate-100">{selAsset.area || '—'}</strong></span>
                        <span>•</span>
                        <span>🏷️ TAG: <strong className="text-slate-900 dark:text-slate-100">{selAsset.tag || '—'}</strong></span>
                      </div>
                    </>
                  )
                })()}
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300">
                  Técnico(s) Atribuído(s) ({selectedTechIds.length})
                </label>

                {/* JANELA 1: TÉCNICOS INTERNOS ATIVOS */}
                <div>
                  <div className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>🟧</span> Técnicos Internos Ativos
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-orange-200 dark:border-slate-700 rounded-lg p-2 bg-orange-50/30 dark:bg-slate-900/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {users
                        .filter((u: any) => u.active !== false && isInternalUser(u))
                        .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
                        .map((u) => {
                          const checked = selectedTechIds.includes(u.id) || (u.abbreviation ? selectedTechIds.includes(u.abbreviation) : false)
                          return (
                            <label key={u.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-200 cursor-pointer hover:bg-orange-100/50 dark:hover:bg-slate-800 p-1 rounded transition-colors">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTechIds((prev) => [...prev, u.id])
                                  } else {
                                    setSelectedTechIds((prev) => prev.filter((id) => id !== u.id && id !== u.abbreviation))
                                  }
                                }}
                                className="rounded accent-orange-600 h-3.5 w-3.5"
                              />
                              <span className="truncate">{(u as any).abbreviation ? `[${(u as any).abbreviation}] ` : ''}{u.name}</span>
                            </label>
                          )
                        })}
                    </div>
                  </div>
                </div>

                {/* JANELA 2: EMPRESAS EXTERNAS / PRESTADORES */}
                <div>
                  <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>🟦</span> Empresas Externas / Prestadores
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-blue-200 dark:border-slate-700 rounded-lg p-2 bg-blue-50/30 dark:bg-slate-900/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {users
                        .filter((u: any) => u.active !== false && !isInternalUser(u))
                        .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
                        .map((u) => {
                          const checked = selectedTechIds.includes(u.id) || (u.abbreviation ? selectedTechIds.includes(u.abbreviation) : false)
                          const compName = (u as any).externalCompanyName || (u as any).company || 'Empresa Externa'
                          const abbrText = (u as any).abbreviation ? `[${(u as any).abbreviation}] ` : ''
                          const labelText = u.name.toLowerCase().includes(compName.toLowerCase()) ? `${abbrText}${u.name}` : `${abbrText}${u.name} (${compName})`
                          return (
                            <label key={u.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-200 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-slate-800 p-1 rounded transition-colors">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTechIds((prev) => [...prev, u.id])
                                  } else {
                                    setSelectedTechIds((prev) => prev.filter((id) => id !== u.id && id !== u.abbreviation))
                                  }
                                }}
                                className="rounded accent-blue-600 h-3.5 w-3.5"
                              />
                              <span className="truncate" title={labelText}>{labelText}</span>
                            </label>
                          )
                        })}
                    </div>
                  </div>
                </div>
              </div>

              <input type="hidden" name="assignedToIds" value={JSON.stringify(selectedTechIds)} />
              <input
                type="hidden"
                name="assignedTo"
                value={selectedTechIds
                  .map((id) => {
                    const u = users.find((usr) => usr.id === id || usr.abbreviation === id)
                    return u ? (u.abbreviation || u.name) : id
                  })
                  .join(', ')}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Data Planeada de Início</label>
                  <input type="datetime-local" name="plannedStartDate" defaultValue={editing?.plannedStartDate ?? ''} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Prazo / Conclusão</label>
                  <input type="date" name="dueDate" defaultValue={editing?.dueDate ?? ''} className="input" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição da Intervenção</label>
                <textarea name="description" defaultValue={editing?.description ?? ''} className="input" rows={2} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Observações Adicionais</label>
                <textarea name="observacoes" defaultValue={editing?.observacoes ?? ''} className="input" rows={2} placeholder="Instruções específicas ou notas sobre a intervenção..." />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Estado</label>
                  <select name="status" defaultValue={editing?.status ?? 'pending'} className="input">
                    {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Regras de Segurança</span>
                  <a href="/dashboard/safety-rules" target="_blank" className="text-[11px] font-bold text-safety-orange hover:underline">
                    Gerir Itens de Segurança ↗
                  </a>
                </div>
                <DynamicList
                  label=""
                  icon={ShieldAlert}
                  items={safetyRules}
                  onChange={setSafetyRules}
                  placeholder="Ex.: Usar EPI, desligar máquina antes…"
                  addLabel="Adicionar regra"
                  suggestions={PREDEFINED_SAFETY_RULES}
                />
              </div>

              <TaskMaterialsPicker
                items={materialsRequired}
                onChange={setMaterialsRequired}
                stockRefs={stockRefs}
                stockLoading={stockLoading}
              />

              {isManager && (
                <TaskDocPickerManager
                  selectedFRs={requiredFRs}
                  selectedITs={requiredITs}
                  onChangeFRs={setRequiredFRs}
                  onChangeITs={setRequiredITs}
                />
              )}

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
