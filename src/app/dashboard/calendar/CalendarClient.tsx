'use client'

import React, { useState, useTransition, useId } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Wrench, ClipboardList, ShieldAlert, X, Plus, Minus, Package, RefreshCw, Copy, Check, ExternalLink, Share2, Calendar as CalendarIcon, GripVertical, Printer, CheckSquare, Square, Pencil } from 'lucide-react'
import type { Task, MaintenancePlan, TaskCriticidade, TipoTarefa, TaskStatus, RecurrenceType, UserRole } from '@/types/models'
import { CRITICIDADE_LABELS, TIPO_LABELS, RECURRENCE_LABELS } from '@/types/models'
import { createTaskFromPlanAction, rescheduleCalendarItemAction } from './actions'
import { createTaskAction, updateTaskStatusAction } from '@/app/dashboard/tasks/actions'
import Avatar from '@/components/ui/Avatar'
import MaterialsSelector from '@/components/ui/MaterialsSelector'
import SearchableAssetSelect from '@/components/ui/SearchableAssetSelect'
import { getTipoBadgeClass } from '@/components/ui/TipoBadge'
import MultiSelectPopoverFilter from '@/components/ui/MultiSelectPopoverFilter'
import CreateTaskModal from '@/components/modals/CreateTaskModal'
import { calculatePlanAnnualDates } from '@/lib/pm-generator'

type Ref = { id: string; name: string; tag?: string | null; area?: string | null }
type UserRef = Ref & {
  avatarUrl?: string | null
  active?: boolean
  abbreviation?: string | null
  role?: string | null
  isExternal?: boolean
  externalCompanyId?: string | null
  externalCompanyName?: string | null
}
type ViewMode = 'month' | 'week' | 'day'

interface CalendarEvent {
  date: string
  type: 'task' | 'plan'
  task?: Task
  plan?: MaintenancePlan
  label: string
  criticidade: TaskCriticidade
}

function addInterval(date: Date, recurrence: RecurrenceType, value: number): Date {
  const d = new Date(date)
  switch (recurrence) {
    case 'daily':     d.setDate(d.getDate() + value); break
    case 'weekly':    d.setDate(d.getDate() + value * 7); break
    case 'monthly':   d.setMonth(d.getMonth() + value); break
    case 'quarterly': d.setMonth(d.getMonth() + value * 3); break
    case 'annual':    d.setFullYear(d.getFullYear() + value); break
  }
  return d
}

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function computePlanOccurrencesInRange(plan: MaintenancePlan, start: Date, end: Date): string[] {
  const anchor = plan.lastGeneratedAt
    ? new Date(plan.lastGeneratedAt)
    : new Date(plan.createdAt)
  const occurrences: string[] = []
  let cur = new Date(anchor)
  if (cur > end) return []
  while (cur <= end) {
    const next = addInterval(cur, plan.recurrence, plan.recurrenceValue)
    if (next >= start && next <= end) occurrences.push(toYMD(next))
    if (next > end) break
    cur = next
  }
  return occurrences
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return (d + 6) % 7 // Monday = 0
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function getPlanTargetDates(plan: MaintenancePlan, targetYear = 2026): string[] {
  return calculatePlanAnnualDates(plan, targetYear)
}

function buildEventMap(tasks: Task[], plans: MaintenancePlan[], start: Date, end: Date): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  function add(date: string, ev: CalendarEvent) {
    if (!map.has(date)) map.set(date, [])
    map.get(date)!.push(ev)
  }

  tasks.forEach((task) => {
    let dates: string[] = []
    const d = task.dueDate ? task.dueDate.slice(0, 10) : task.plannedStartDate ? task.plannedStartDate.slice(0, 10) : null
    if (d) {
      dates = [d]
    } else {
      const linkedPlan = task.maintenancePlanId ? plans.find((p) => p.id === task.maintenancePlanId) : null
      if (linkedPlan) {
        dates = getPlanTargetDates(linkedPlan, start.getFullYear())
      }
    }

    dates.forEach((d) => {
      const dd = new Date(d + 'T12:00:00')
      if (dd >= start && dd <= end) {
        add(d, { date: d, type: 'task', task, label: task.title, criticidade: task.criticidade })
      }
    })
  })

  plans.filter((p) => p.active !== false).forEach((plan) => {
    // Se este plano já tiver uma OT em taskList (convertida ou reagendada),
    const hasConvertedTask = tasks.some(
      (t) =>
        t.maintenancePlanId === plan.id ||
        t.id === plan.id ||
        t.id === `plan_${plan.id}` ||
        plan.id === `plan_${t.id}` ||
        (t.maintenancePlanId && plan.id.endsWith(t.maintenancePlanId))
    )
    if (hasConvertedTask) {
      return
    }

    const targetDates = getPlanTargetDates(plan, start.getFullYear())
    if (targetDates.length > 0) {
      targetDates.forEach((d) => {
        const dd = new Date(d + 'T12:00:00')
        if (dd >= start && dd <= end) {
          add(d, { date: d, type: 'plan', plan, label: plan.title, criticidade: plan.criticidade })
        }
      })
    } else if (plan.showInCalendar || (plan.calendarDates && plan.calendarDates.length > 0)) {
      computePlanOccurrencesInRange(plan, start, end).forEach((d) =>
        add(d, { date: d, type: 'plan', plan, label: plan.title, criticidade: plan.criticidade })
      )
    }
  })

  return map
}

function eventTag(ev: CalendarEvent): string {
  return ((ev.type === 'task' ? ev.task?.tag : ev.plan?.tag) || '').trim()
}
function eventDescription(ev: CalendarEvent): string {
  return ((ev.type === 'task' ? ev.task?.description : ev.plan?.description) || '').trim()
}
/** Texto do chip no calendário: começa sempre pela TAG do equipamento, quando existe. */
function eventDisplayLabel(ev: CalendarEvent): string {
  const tag = eventTag(ev)
  return tag ? `${tag} — ${ev.label}` : ev.label
}
/** Tooltip ao passar o rato: TAG + Descrição do trabalho. */
function eventTooltip(ev: CalendarEvent): string {
  const tag = eventTag(ev)
  const desc = eventDescription(ev)
  if (tag && desc) return `${tag} — ${desc}`
  if (tag) return `${tag} — ${ev.label}`
  return desc || ev.label
}

function resolveEventType(ev: CalendarEvent): string {
  if (ev.type === 'plan') return 'plano'
  const t = ev.task
  if (!t) return 'curativa'
  const tipoStr = String(t.tipo || '').toLowerCase()
  if ((t as any).source === 'folha_projetos' || (t as any).isProject || tipoStr === 'projeto' || tipoStr === 'projetos' || (t.description || '').toLowerCase().includes('projeto') || (t.description || '').toLowerCase().includes('projecto')) {
    return 'projeto'
  }
  return t.tipo || 'curativa'
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
// Sem o Tipo PM na criação manual de OT (apenas no Plano de Manutenção)
const TIPOS_CREATION: TipoTarefa[] = ['preventiva', 'curativa', 'pi', 'inspecao', 'lubrificacao', 'calibracao', 'outro']
const CRITICIDADES: TaskCriticidade[] = ['vermelho', 'amarelo', 'verde']

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

function DynamicList({ label, icon, items, onChange, suggestions }: {
  label: string
  icon: React.ReactNode
  items: string[]
  onChange: (items: string[]) => void
  suggestions?: string[]
}) {
  const datalistId = useId()
  function update(i: number, val: string) {
    const next = [...items]; next[i] = val; onChange(next)
  }
  function add() { onChange([...items, '']) }
  function remove(i: number) { onChange(items.filter((_, j) => j !== i)) }
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
          {icon}{label}
        </label>
      )}
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={item}
              onChange={(e) => update(i, e.target.value)}
              className="input flex-1 text-sm"
              placeholder={`Item ${i + 1}`}
              list={suggestions ? datalistId : undefined}
            />
            <button type="button" onClick={() => remove(i)} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded">
              <Minus className="h-3.5 w-3.5" />
            </button>
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
      <button type="button" onClick={add} className="mt-1.5 flex items-center gap-1 text-xs text-[#2E86C1] dark:text-blue-400 hover:underline">
        <Plus className="h-3 w-3" /> Adicionar
      </button>
    </div>
  )
}

export default function CalendarClient({
  tasks,
  plans,
  assets,
  users,
  role,
  userId,
}: {
  tasks: Task[]
  plans: MaintenancePlan[]
  assets: Ref[]
  users: UserRef[]
  role: UserRole
  userId: string
}) {
  const router = useRouter()
  const today = new Date()

  const [taskList, setTaskList] = useState<Task[]>(tasks)
  const [planList, setPlanList] = useState<MaintenancePlan[]>(plans)

  React.useEffect(() => { setTaskList(tasks) }, [tasks])
  React.useEffect(() => { setPlanList(plans) }, [plans])

  // Month view state
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  // Week view state
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today))
  // Filter states
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTechs, setSelectedTechs] = useState<string[]>([])
  const [selectedTIs, setSelectedTIs] = useState<string[]>([])

  // Shared
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [copiedFeed, setCopiedFeed] = useState(false)

  // Create from plan
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null)
  const [assignTo, setAssignTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [planBusy, startPlanTransition] = useTransition()
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)

  // Create new task from calendar
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [ntTitle, setNtTitle] = useState('')
  const [ntTipo, setNtTipo] = useState<TipoTarefa>('preventiva')
  const [ntCriticidade, setNtCriticidade] = useState<TaskCriticidade>('verde')
  const [ntAsset, setNtAsset] = useState('')
  const [ntAssigned, setNtAssigned] = useState(role === 'technician' ? userId : '')
  const [ntPlannedStartDate, setNtPlannedStartDate] = useState('')
  const [ntDescription, setNtDescription] = useState('')
  const [ntObservacoes, setNtObservacoes] = useState('')
  const [ntSafetyRules, setNtSafetyRules] = useState<string[]>([''])
  const [ntMaterials, setNtMaterials] = useState<string[]>([''])
  const [ntBusy, startNtTransition] = useTransition()
  const [ntError, setNtError] = useState('')

  // Edit existing task modal from calendar (reutiliza o mesmo CreateTaskModal das OTs)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  function openEditTask(task: Task) {
    setEditingTask(task)
  }

  function openPlanAsOT(plan: MaintenancePlan, targetDate?: string) {
    const dateStr = targetDate || plan.calendarStartDate || toYMD(new Date())
    const planTasks = taskList.filter(
      (t) => t.maintenancePlanId === plan.id || (t.title && t.title.toLowerCase().includes(plan.title.toLowerCase()))
    )
    // Se houver várias ocorrências agendadas (uma por data), abre exatamente a que
    // corresponde à data clicada no calendário — não sempre a primeira encontrada.
    const existingTask = (targetDate && planTasks.find((t) => (t.dueDate || '').slice(0, 10) === targetDate))
      || planTasks[0]
    if (existingTask) {
      openEditTask(existingTask)
    } else {
      const planTask: Task = {
        id: `plan_${plan.id}`,
        companyId: plan.companyId,
        title: `[PM] ${plan.title}`,
        description: plan.description || `Plano de Manutenção: ${plan.periodicidadeLabel || plan.periodicidade || 'PM'} | TAG: ${plan.tag || '—'}`,
        assetId: plan.assetId || '',
        assignedTo: plan.assignedTo || '',
        criticidade: plan.criticidade || 'verde',
        tipo: 'plano' as TipoTarefa,
        status: 'pending' as TaskStatus,
        dueDate: dateStr,
        plannedStartDate: dateStr,
        createdAt: dateStr,
        updatedAt: dateStr,
        createdBy: plan.createdBy || '',
        safetyRules: plan.safetyRules || [],
        maintenancePlanId: plan.id,
      }
      openEditTask(planTask)
    }
  }

  // Drag and Drop state & handlers (Estilo Gmail / Google Calendar / Outlook)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [isRescheduling, startRescheduleTransition] = useTransition()

  function handleDragStart(e: React.DragEvent, ev: CalendarEvent) {
    const id = ev.type === 'task' ? ev.task?.id : (ev.plan?.id ? `plan_${ev.plan.id}` : null)
    if (!id) return
    const payload = JSON.stringify({ type: ev.type, id, originalDate: ev.date })
    e.dataTransfer.setData('text/plain', payload)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, dateStr: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverDate !== dateStr) {
      setDragOverDate(dateStr)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOverDate(null)
  }

  async function handleDropOnDate(e: React.DragEvent, targetDate: string) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverDate(null)

    const rawData = e.dataTransfer.getData('text/plain')
    if (!rawData) return
    try {
      const { type, id, originalDate } = JSON.parse(rawData) as { type: 'task' | 'plan'; id: string; originalDate?: string }
      if (!id || originalDate === targetDate) return

      const targetTaskId = id.startsWith('plan_') ? id : (type === 'plan' ? `plan_${id}` : id)
      const targetPlanId = targetTaskId.startsWith('plan_') ? targetTaskId.replace('plan_', '') : null

      setTaskList((prev) => {
        const exists = prev.some((t) => t.id === targetTaskId)
        if (exists) {
          return prev.map((t) => (t.id === targetTaskId ? { ...t, dueDate: targetDate, plannedStartDate: `${targetDate}T09:00` } : t))
        }
        const p = targetPlanId ? planList.find((pl) => pl.id === targetPlanId) : null
        const newTask: Task = {
          id: targetTaskId,
          companyId: p?.companyId || '',
          title: p ? `[PM] ${p.title}` : 'Nova OT',
          assetId: p?.assetId || null,
          assignedTo: p?.assignedTo || null,
          criticidade: p?.criticidade || 'verde',
          tipo: 'plano',
          status: 'pending',
          dueDate: targetDate,
          plannedStartDate: `${targetDate}T09:00`,
          createdAt: targetDate,
          updatedAt: targetDate,
          createdBy: userId,
          maintenancePlanId: targetPlanId,
        }
        return [newTask, ...prev]
      })

      if (targetPlanId) {
        setPlanList((prev) =>
          prev.map((p) =>
            p.id === targetPlanId
              ? {
                  ...p,
                  calendarStartDate: targetDate,
                  calendarDates: [targetDate],
                  nextDueDate: targetDate,
                }
              : p
          )
        )
      }

      startRescheduleTransition(async () => {
        const res = await rescheduleCalendarItemAction(type, id, targetDate, originalDate)
        if (res.error) {
          console.warn(`Erro ao reagendar: ${res.error}`)
        } else {
          router.refresh()
        }
      })
    } catch (err) {
      console.error('Erro no drag & drop:', err)
    }
  }

  // Toggle OT status directly in calendar (gestores apenas)
  const [isTogglingStatus, startStatusTransition] = useTransition()
  const [showPrintModal, setShowPrintModal] = useState(false)

  async function handleToggleTaskStatus(taskId: string, currentStatus: string) {
    if (role !== 'manager') {
      alert('Apenas gestores podem encerrar OTs no calendário.')
      return
    }
    const isDone = currentStatus === 'done' || currentStatus === 'completed'
    const newStatus = isDone ? 'pending' : 'done'

    startStatusTransition(async () => {
      const res = await updateTaskStatusAction(taskId, newStatus)
      if (res.error) {
        alert(`Erro ao atualizar estado: ${res.error}`)
      } else {
        router.refresh()
      }
    })
  }

  // Navigation
  function prevPeriod() {
    setSelectedDate(null)
    if (viewMode === 'month') {
      if (month === 0) { setYear((y) => y - 1); setMonth(11) }
      else setMonth((m) => m - 1)
    } else if (viewMode === 'week') {
      setWeekStart((ws) => { const d = new Date(ws); d.setDate(d.getDate() - 7); return d })
    } else {
      // Day view: recuar 1 dia
      if (selectedDate) {
        const d = new Date(selectedDate + 'T12:00:00')
        d.setDate(d.getDate() - 1)
        setSelectedDate(toYMD(d))
      }
    }
  }
  function nextPeriod() {
    setSelectedDate(null)
    if (viewMode === 'month') {
      if (month === 11) { setYear((y) => y + 1); setMonth(0) }
      else setMonth((m) => m + 1)
    } else if (viewMode === 'week') {
      setWeekStart((ws) => { const d = new Date(ws); d.setDate(d.getDate() + 7); return d })
    } else {
      // Day view: avançar 1 dia
      if (selectedDate) {
        const d = new Date(selectedDate + 'T12:00:00')
        d.setDate(d.getDate() + 1)
        setSelectedDate(toYMD(d))
      }
    }
  }

  const assetMap = React.useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  const uniqueAreas = React.useMemo(() => {
    const set = new Set<string>()
    assets.forEach((a) => { if (a.area && a.area.trim()) set.add(a.area.trim()) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [assets])

  const uniqueTags = React.useMemo(() => {
    const set = new Set<string>()
    assets.forEach((a) => { if (a.tag && a.tag.trim()) set.add(a.tag.trim()) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [assets])

  const uniqueTechnicians = React.useMemo(() => {
    return users.map((u) => ({ value: u.id, label: (u as any).abbreviation ? `${(u as any).abbreviation} - ${u.name}` : u.name }))
  }, [users])

  const filteredTaskList = React.useMemo(() => {
    return taskList.filter((t) => {
      const assetObj = t.assetId ? assetMap.get(t.assetId) : null
      const aArea = ((t as any).area || assetObj?.area || '').trim().toLowerCase()
      const aTag = ((t as any).tag || assetObj?.tag || '').trim().toLowerCase()
      const tTipo = String(t.tipo || '').toLowerCase()
      const tTi = String((t as any).ti || (t as any).tipoText || '').toLowerCase()
      const assignedId = String(t.assignedTo || '').toLowerCase()

      if (selectedAreas.length > 0) {
        if (!selectedAreas.some((a) => aArea === a.toLowerCase() || aArea.startsWith(a.toLowerCase()))) return false
      }
      if (selectedTags.length > 0) {
        if (!selectedTags.some((tag) => aTag === tag.toLowerCase() || aTag.startsWith(tag.toLowerCase()))) return false
      }
      if (selectedTechs.length > 0) {
        if (!selectedTechs.some((u) => assignedId.includes(u.toLowerCase()))) return false
      }
      if (selectedTIs.length > 0) {
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
      }
      return true
    })
  }, [taskList, assetMap, selectedAreas, selectedTags, selectedTechs, selectedTIs])

  // Event maps
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59)
  const eventMap = viewMode === 'month'
    ? buildEventMap(filteredTaskList, planList, monthStart, monthEnd)
    : buildEventMap(filteredTaskList, planList, weekStart, weekEnd)

  const todayStr = toYMD(today)
  const activeSelectedDate = selectedDate || todayStr
  const selectedEvents = selectedDate ? (eventMap.get(selectedDate) ?? []) : []

  // Month grid cells
  const monthDays = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const monthCells: (number | null)[] = Array(firstDay).fill(null)
  for (let i = 1; i <= monthDays; i++) monthCells.push(i)
  while (monthCells.length % 7 !== 0) monthCells.push(null)

  // Week dates
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return toYMD(d)
  })

  // Header label
  const headerLabel = viewMode === 'month'
    ? `${MONTH_NAMES[month]} ${year}`
    : viewMode === 'week'
    ? (() => {
        const ws = weekStart.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
        const we = new Date(weekStart); we.setDate(we.getDate() + 6)
        const weStr = we.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
        return `${ws} — ${weStr}`
      })()
    : new Date(activeSelectedDate + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  async function handleCreateFromPlan() {
    if (!selectedPlan || !selectedDate) return
    setCreateError('')
    startPlanTransition(async () => {
      const fd = new FormData()
      fd.set('planId', selectedPlan.id)
      fd.set('dueDate', dueDate || selectedDate)
      if (assignTo) fd.set('assignedTo', assignTo)
      const result = await createTaskFromPlanAction({}, fd)
      if (result.error) { setCreateError(result.error); return }
      setCreateSuccess(true)
      setSelectedPlan(null)
      router.refresh()
      setTimeout(() => setCreateSuccess(false), 2000)
    })
  }

  function openNewTaskForDate(targetDate: string) {
    setSelectedDate(targetDate)
    setNtTitle(''); setNtTipo('preventiva'); setNtCriticidade('verde')
    setNtAsset(''); setNtAssigned(role === 'technician' ? userId : '')
    setNtPlannedStartDate(`${targetDate}T09:00`)
    setNtDescription(''); setNtObservacoes('')
    setNtSafetyRules(['']); setNtMaterials(['']); setNtError('')
    setNewTaskOpen(true)
  }

  async function handleCreateNewTask() {
    if (!selectedDate || !ntTitle.trim()) { setNtError('O título é obrigatório.'); return }
    startNtTransition(async () => {
      const fd = new FormData()
      fd.set('title', ntTitle.trim())
      fd.set('tipo', ntTipo)
      fd.set('criticidade', ntCriticidade)
      fd.set('status', 'pending')
      fd.set('dueDate', selectedDate)
      if (ntPlannedStartDate) fd.set('plannedStartDate', ntPlannedStartDate)
      if (ntDescription.trim()) fd.set('description', ntDescription.trim())
      if (ntObservacoes.trim()) fd.set('observacoes', ntObservacoes.trim())
      if (ntAsset) fd.set('assetId', ntAsset)
      if (ntAssigned) fd.set('assignedTo', ntAssigned)
      const validSafety = ntSafetyRules.filter((r) => r.trim())
      if (validSafety.length) fd.set('safetyRules', JSON.stringify(validSafety))
      const validMaterials = ntMaterials.filter((m) => m.trim())
      if (validMaterials.length) fd.set('materialsRequired', JSON.stringify(validMaterials))
      const result = await createTaskAction({}, fd)
      if (result.error) { setNtError(result.error); return }
      setNewTaskOpen(false)
      router.refresh()
    })
  }

  function goToToday() {
    const t = new Date()
    setYear(t.getFullYear())
    setMonth(t.getMonth())
    setWeekStart(getWeekStart(t))
    setSelectedDate(toYMD(t))
  }

  function assetName(id?: string | null) { return assets.find((a) => a.id === id)?.name ?? '—' }
  function userName(id?: string | null) { return users.find((u) => u.id === id)?.name ?? '—' }
  function userRef(id?: string | null) { return users.find((u) => u.id === id) }

  // Horas para vista Dia (08:00 às 20:00)
  const HOURS = Array.from({ length: 13 }, (_, i) => String(i + 8).padStart(2, '0') + ':00')

  return (
    <div>
      {/* Header com botões e navegadores */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-3 bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Navegação Prev / Hoje / Next */}
          <div className="flex items-center gap-1">
            <button onClick={prevPeriod} className="p-1.5 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer" title="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={goToToday} className="px-2.5 py-1 bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors border border-slate-300/60 dark:border-slate-700 cursor-pointer">
              Hoje
            </button>
            <button onClick={nextPeriod} className="p-1.5 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer" title="Seguinte">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Mês/Ano */}
          <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-slate-100 capitalize min-w-[130px]">
            {headerLabel}
          </h2>

          {/* Vista Mês/Semana/Dia */}
          <div className="flex rounded-lg border border-gray-300 dark:border-slate-700 overflow-hidden text-xs font-bold">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 font-bold transition-colors cursor-pointer ${viewMode === 'month' ? 'bg-[#1B4F72] text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
            >
              Mês
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 font-bold transition-colors cursor-pointer ${viewMode === 'week' ? 'bg-[#1B4F72] text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
            >
              Semana
            </button>
            <button
              onClick={() => {
                setViewMode('day')
                if (!selectedDate) setSelectedDate(todayStr)
              }}
              className={`px-3 py-1 font-bold transition-colors cursor-pointer ${viewMode === 'day' ? 'bg-[#1B4F72] text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
            >
              Dia
            </button>
          </div>
        </div>

        {/* Botões do Topo: Imprimir Agendamentos, Sincronização e Nova OT */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => setShowPrintModal(true)}
            className="h-8.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl shadow-sm border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            title="Imprimir relatório de agendamentos da semana ou mês"
          >
            <Printer size={14} className="text-slate-600 dark:text-slate-300 shrink-0" />
            <span className="whitespace-nowrap">Imprimir Agendamentos</span>
          </button>
          <button
            onClick={() => setShowSyncModal(true)}
            className="h-8.5 px-3 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-900 dark:text-blue-300 font-bold text-xs rounded-xl shadow-sm border border-blue-300 dark:border-blue-700 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <RefreshCw size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="whitespace-nowrap">Sincronizar (Gmail / Outlook)</span>
          </button>
          <button
            onClick={() => openNewTaskForDate(selectedDate || todayStr)}
            className="h-8.5 px-3.5 bg-safety-orange hover:bg-safety-orange/90 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Plus size={15} className="shrink-0" />
            <span className="whitespace-nowrap">Nova OT</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros Multi-Seleção */}
      <div className="flex items-center gap-2 mb-4 flex-wrap bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <span className="text-xs font-extrabold uppercase text-slate-500 mr-1">Filtros:</span>
        <MultiSelectPopoverFilter
          label="Área"
          options={uniqueAreas.map((a) => ({ value: a, label: `Área: ${a}` }))}
          selectedValues={selectedAreas}
          onChange={setSelectedAreas}
          placeholder="Área (Todas)"
        />
        <MultiSelectPopoverFilter
          label="TAG"
          options={uniqueTags.map((t) => ({ value: t, label: `TAG: ${t}` }))}
          selectedValues={selectedTags}
          onChange={setSelectedTags}
          placeholder="TAG (Todas)"
        />
        <MultiSelectPopoverFilter
          label="Técnico"
          options={uniqueTechnicians}
          selectedValues={selectedTechs}
          onChange={setSelectedTechs}
          placeholder="Técnico (Todos)"
        />
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
        />
      </div>

      {/* Legend & Drag Info */}
      <div className="flex items-center gap-4 mb-3 text-xs font-semibold text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><ClipboardList className="h-4 w-4 text-[#2E86C1]" /> OT atribuída</span>
        <span className="flex items-center gap-1.5"><Wrench className="h-4 w-4 text-amber-500" /> Plano de manutenção</span>
        <span className="flex items-center gap-1 text-safety-orange font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
          <GripVertical className="h-3.5 w-3.5" /> Arraste qualquer item para alterar a data (estilo Gmail / Outlook)
        </span>
      </div>

      {isRescheduling && (
        <div className="mb-3 p-2.5 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2 animate-pulse">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
          <span>A atualizar agendamento no calendário...</span>
        </div>
      )}

      {/* Month grid */}
      {viewMode === 'month' && (
        <div className="card overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-extrabold text-slate-700 dark:text-slate-300 py-3 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((day, i) => {
              if (day === null) return <div key={i} className="border-b border-r border-gray-100 dark:border-slate-800/50 min-h-[110px] lg:min-h-[135px] bg-slate-50/40 dark:bg-slate-950/40" />
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const events = eventMap.get(dateStr) ?? []
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const isPast = dateStr < todayStr
              const isOver = dragOverDate === dateStr
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(dateStr)}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnDate(e, dateStr)}
                  className={`border-b border-r border-slate-100 dark:border-slate-800 min-h-[110px] lg:min-h-[135px] p-2 cursor-pointer transition-all flex flex-col justify-between ${
                    isOver ? 'bg-amber-100/90 dark:bg-amber-900/60 ring-4 ring-safety-orange scale-[1.02] z-20 shadow-2xl' :
                    isSelected ? 'bg-blue-50/80 dark:bg-blue-900/30 ring-2 ring-blue-400 z-10' :
                    isPast ? 'bg-gray-50/60 dark:bg-slate-900/40 hover:bg-gray-100/60 dark:hover:bg-slate-800/40' :
                    'hover:bg-gray-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-extrabold w-7 h-7 flex items-center justify-center rounded-full shadow-sm ${
                        isToday ? 'bg-[#2E86C1] text-white font-bold ring-2 ring-blue-300' : isPast ? 'text-gray-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'
                      }`}>
                        {day}
                      </span>
                      {events.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {events.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {events.slice(0, 4).map((ev, j) => {
                        const isTaskDone = ev.type === 'task' && ev.task && (ev.task.status === 'done' || (ev.task.status as string) === 'completed')
                        return (
                          <div
                            key={j}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, ev)}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (ev.type === 'task' && ev.task) {
                                openEditTask(ev.task)
                              } else if (ev.type === 'plan' && ev.plan) {
                                openPlanAsOT(ev.plan, dateStr)
                              }
                            }}
                            title={`Arraste para alterar a data ou clique para ver: ${eventTooltip(ev)}`}
                            className={`text-[11px] font-medium rounded-md px-1.5 py-1 truncate transition-all hover:scale-[1.02] active:scale-95 shadow-sm border cursor-grab active:cursor-grabbing flex items-center justify-between gap-1 ${
                              isTaskDone ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 line-through opacity-85' : getTipoBadgeClass(resolveEventType(ev))
                            }`}
                          >
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                              {ev.type === 'task' && ev.task && (
                                <input
                                  type="checkbox"
                                  checked={Boolean(isTaskDone)}
                                  disabled={role !== 'manager' || isTogglingStatus}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    handleToggleTaskStatus(ev.task!.id, ev.task!.status)
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                                  title={role === 'manager' ? (isTaskDone ? 'Marcar como pendente' : 'Encerrar OT no calendário') : 'Apenas gestores podem encerrar OTs'}
                                />
                              )}
                              <span className="truncate">{eventDisplayLabel(ev)}</span>
                            </div>
                            <GripVertical className="h-3 w-3 text-slate-400 opacity-60 shrink-0 inline" />
                          </div>
                        )
                      })}
                      {events.length > 4 && (
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center">
                          +{events.length - 4} mais
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Week grid */}
      {viewMode === 'week' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-800">
            {weekDates.map((dateStr, i) => {
              const d = new Date(dateStr + 'T12:00:00')
              const isToday = dateStr === todayStr
              const isPast = dateStr < todayStr
              return (
                <div key={i} className="text-center py-2">
                  <p className={`text-xs ${isPast ? 'text-gray-300 dark:text-slate-600' : 'text-gray-400 dark:text-slate-400'}`}>{WEEK_DAYS[i]}</p>
                  <p className={`text-sm font-semibold mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5 ${
                    isToday ? 'bg-[#2E86C1] text-white' : isPast ? 'text-gray-300 dark:text-slate-600' : 'text-gray-700 dark:text-slate-300'
                  }`}>
                    {d.getDate()}
                  </p>
                  <p className={`text-[10px] ${isPast ? 'text-gray-300 dark:text-slate-600' : 'text-gray-400 dark:text-slate-400'}`}>{MONTH_NAMES[d.getMonth()].slice(0, 3)}</p>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-7 divide-x divide-gray-50 dark:divide-slate-800/50">
            {weekDates.map((dateStr, i) => {
              const events = eventMap.get(dateStr) ?? []
              const isSelected = dateStr === selectedDate
              const isPast = dateStr < todayStr
              const isOver = dragOverDate === dateStr
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(dateStr)}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnDate(e, dateStr)}
                  className={`min-h-[140px] p-1.5 cursor-pointer transition-colors ${
                    isOver ? 'bg-amber-100/90 dark:bg-amber-900/60 ring-2 ring-safety-orange' :
                    isSelected ? 'bg-[#EAF4FB] dark:bg-blue-900/20' :
                    isPast ? 'bg-gray-50/60 dark:bg-slate-900/40 hover:bg-gray-100/60 dark:hover:bg-slate-800/40' :
                    'hover:bg-gray-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="space-y-1">
                    {events.map((ev, j) => {
                      const isTaskDone = ev.type === 'task' && ev.task && (ev.task.status === 'done' || (ev.task.status as string) === 'completed')
                      return (
                        <div
                          key={j}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, ev)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (ev.type === 'task' && ev.task) openEditTask(ev.task)
                          }}
                          title={`Arraste para alterar a data: ${eventTooltip(ev)}`}
                          className={`text-[10px] rounded px-1 py-0.5 leading-tight cursor-grab active:cursor-grabbing flex items-center justify-between gap-1 ${
                            isTaskDone ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 line-through opacity-85' : getTipoBadgeClass(resolveEventType(ev))
                          }`}
                        >
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            {ev.type === 'task' && ev.task && (
                              <input
                                type="checkbox"
                                checked={Boolean(isTaskDone)}
                                disabled={role !== 'manager' || isTogglingStatus}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleToggleTaskStatus(ev.task!.id, ev.task!.status)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3 w-3 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                                title={role === 'manager' ? (isTaskDone ? 'Marcar como pendente' : 'Encerrar OT no calendário') : 'Apenas gestores podem encerrar OTs'}
                              />
                            )}
                            <span className="truncate">{eventDisplayLabel(ev)}</span>
                          </div>
                          <GripVertical className="h-2.5 w-2.5 text-slate-400 opacity-60 shrink-0 inline" />
                        </div>
                      )
                    })}
                    {events.length === 0 && (
                      <p className="text-[10px] text-gray-300 dark:text-slate-600 text-center mt-4">+</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Day View (Grelha de Horas estilo Gmail / Google Calendar) */}
      {viewMode === 'day' && (
        <div className="card overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
          <div className="p-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
              Agenda do Dia: {new Date(activeSelectedDate + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => openNewTaskForDate(activeSelectedDate)}
              className="px-3 py-1 bg-safety-orange text-white text-xs font-bold rounded-lg hover:bg-safety-orange/90 transition-all flex items-center gap-1"
            >
              <Plus size={14} /> + Nova OT Neste Dia
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {HOURS.map((hour) => {
              const events = selectedEvents
              const isOver = dragOverDate === activeSelectedDate
              return (
                <div
                  key={hour}
                  onClick={() => setSelectedDate(activeSelectedDate)}
                  onDragOver={(e) => handleDragOver(e, activeSelectedDate)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnDate(e, activeSelectedDate)}
                  className={`p-3 transition-colors flex items-center gap-4 cursor-pointer group ${
                    isOver ? 'bg-amber-100/80 dark:bg-amber-900/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span className="font-mono text-xs font-bold text-slate-400 w-12">{hour}</span>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {events.map((ev, j) => {
                      const isTaskDone = ev.type === 'task' && ev.task && (ev.task.status === 'done' || (ev.task.status as string) === 'completed')
                      return (
                        <div
                          key={j}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, ev)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (ev.type === 'task' && ev.task) openEditTask(ev.task)
                            else if (ev.type === 'plan' && ev.plan) openPlanAsOT(ev.plan, activeSelectedDate)
                          }}
                          title={`Arraste para alterar a data: ${eventTooltip(ev)}`}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing flex items-center gap-1.5 ${
                            isTaskDone ? 'bg-emerald-100 text-emerald-900 border-emerald-300 line-through opacity-85' : getTipoBadgeClass(resolveEventType(ev))
                          }`}
                        >
                          <GripVertical className="h-3 w-3 text-slate-400 opacity-60 shrink-0" />
                          {ev.type === 'task' && ev.task && (
                            <input
                              type="checkbox"
                              checked={Boolean(isTaskDone)}
                              disabled={role !== 'manager' || isTogglingStatus}
                              onChange={(e) => {
                                e.stopPropagation()
                                handleToggleTaskStatus(ev.task!.id, ev.task!.status)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                              title={role === 'manager' ? (isTaskDone ? 'Marcar como pendente' : 'Encerrar OT no calendário') : 'Apenas gestores podem encerrar OTs'}
                            />
                          )}
                          <span>{eventDisplayLabel(ev)}</span>
                        </div>
                      )
                    })}
                    {events.length === 0 && (
                      <span className="text-xs text-slate-300 dark:text-slate-600 group-hover:text-safety-orange font-medium transition-colors">
                        + Clique para agendar OT às {hour}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Day detail panel */}
      {selectedDate && (
        <div className="mt-4 card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 dark:text-slate-200">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex items-center gap-2">
              {selectedDate >= todayStr && (
                <button
                  onClick={() => openNewTaskForDate(selectedDate)}
                  className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
                >
                  <Plus className="h-3.5 w-3.5" /> Nova OT
                </button>
              )}
              <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500">
              {selectedDate < todayStr
                ? 'Sem eventos registados para este dia.'
                : 'Sem eventos para este dia. Clica em “Nova OT” para criar uma.'}
            </p>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map((ev, i) => {
                const isTaskDone = ev.type === 'task' && ev.task && (ev.task.status === 'done' || (ev.task.status as string) === 'completed')
                return (
                  <div key={i} className={`rounded-lg border p-3 transition-all ${isTaskDone ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' : 'border-gray-100 dark:border-slate-800'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {ev.type === 'task' && ev.task ? (
                          <input
                            type="checkbox"
                            checked={Boolean(isTaskDone)}
                            disabled={role !== 'manager' || isTogglingStatus}
                            onChange={() => handleToggleTaskStatus(ev.task!.id, ev.task!.status)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                            title={role === 'manager' ? (isTaskDone ? 'Marcar como pendente' : 'Encerrar OT') : 'Apenas gestores podem encerrar OTs'}
                          />
                        ) : (
                          <Wrench className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        )}
                        <div>
                          <p className={`text-sm font-bold text-gray-800 dark:text-slate-200 ${isTaskDone ? 'line-through opacity-70 text-emerald-900 dark:text-emerald-300' : ''}`} title={eventTooltip(ev)}>
                            {eventDisplayLabel(ev)}
                            {isTaskDone && (
                              <span className="ml-2 text-[10px] font-extrabold text-emerald-800 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-300">Concluída</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center flex-wrap gap-1">
                            {ev.type === 'task' && ev.task && <>
                              <span>{CRITICIDADE_LABELS[ev.task.criticidade]} · {TIPO_LABELS[ev.task.tipo]}</span>
                              {ev.task.assignedTo && (
                                <span className="inline-flex items-center gap-1">
                                  <span>·</span>
                                  <Avatar name={userName(ev.task.assignedTo)} avatarUrl={userRef(ev.task.assignedTo)?.avatarUrl} size={14} />
                                  <span>{userName(ev.task.assignedTo)}</span>
                                </span>
                              )}
                            </>}
                            {ev.type === 'plan' && ev.plan && <>
                              {RECURRENCE_LABELS[ev.plan.recurrence]} · {assetName(ev.plan.assetId)}
                            </>}
                          </p>
                        </div>
                      </div>
                      {ev.type === 'plan' && ev.plan && (
                        <button
                          type="button"
                          onClick={() => openPlanAsOT(ev.plan!, selectedDate)}
                          className="btn-primary flex items-center gap-1 text-xs py-1 px-2.5"
                        >
                          <Pencil size={12} /> <span>Editar / Reagendar OT</span>
                        </button>
                      )}
                      {ev.type === 'task' && ev.task && (
                        <button
                          type="button"
                          onClick={() => openEditTask(ev.task!)}
                          className="btn-primary flex items-center gap-1 text-xs py-1 px-2.5"
                        >
                          <Pencil size={12} /> <span>Editar OT</span>
                        </button>
                      )}
                    </div>
                    {ev.type === 'plan' && ev.plan?.safetyRules && ev.plan.safetyRules.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {ev.plan.safetyRules.length} regra(s) de segurança
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Edição de OT diretamente no Calendário — o mesmo componente usado nas OTs,
          para que uma OT de PM já agendada mostre as datas do calendário e a opção de concluir. */}
      <CreateTaskModal
        isOpen={!!editingTask}
        editingTask={editingTask}
        onClose={() => setEditingTask(null)}
        assets={assets}
        users={users}
        isManager={role === 'manager'}
        onSuccess={() => {
          setEditingTask(null)
          router.refresh()
        }}
      />

      {/* New task modal */}
      {newTaskOpen && selectedDate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setNewTaskOpen(false)} />
          <div className="card relative w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Nova OT</h2>
              <button onClick={() => setNewTaskOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 rounded-lg bg-[#EAF4FB] dark:bg-blue-900/20 px-3 py-2 text-xs text-[#1B4F72] dark:text-blue-300 font-medium">
              Prazo: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Título *</label>
                <input
                  value={ntTitle}
                  onChange={(e) => setNtTitle(e.target.value)}
                  className="input"
                  placeholder="Descrição breve da OT"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Descrição</label>
                <textarea
                  value={ntDescription}
                  onChange={(e) => setNtDescription(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="Detalhes adicionais…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Tipo *</label>
                  <select value={ntTipo} onChange={(e) => setNtTipo(e.target.value as TipoTarefa)} className="input">
                    {TIPOS_CREATION.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Criticidade</label>
                  <select value={ntCriticidade} onChange={(e) => setNtCriticidade(e.target.value as TaskCriticidade)} className="input">
                    {CRITICIDADES.map((c) => <option key={c} value={c}>{CRITICIDADE_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Equipamento</label>
                  <select value={ntAsset} onChange={(e) => setNtAsset(e.target.value)} className="input">
                    <option value="">— Nenhum —</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.tag ? `[${a.tag}] ${a.name}` : a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Responsável (Ativos)</label>
                  <select value={ntAssigned} onChange={(e) => setNtAssigned(e.target.value)} className="input">
                    <option value="">— Ninguém —</option>
                    {users.filter((u) => u.active !== false).map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u as any).abbreviation ? `[${(u as any).abbreviation}] ${u.name}` : u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Data Planeada de Início</label>
                <input
                  type="datetime-local"
                  value={ntPlannedStartDate}
                  onChange={(e) => setNtPlannedStartDate(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Observações</label>
                <textarea
                  value={ntObservacoes}
                  onChange={(e) => setNtObservacoes(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="Observações ou detalhes da intervenção..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> Regras de Segurança
                  </span>
                  <a href="/dashboard/safety-rules" target="_blank" className="text-[11px] font-bold text-safety-orange hover:underline">
                    Gerir Itens de Segurança ↗
                  </a>
                </div>
                <DynamicList
                  label=""
                  icon={null}
                  items={ntSafetyRules}
                  onChange={setNtSafetyRules}
                  suggestions={PREDEFINED_SAFETY_RULES}
                />
              </div>

              <MaterialsSelector
                items={ntMaterials}
                onChange={setNtMaterials}
              />
            </div>

            {ntError && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{ntError}</div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setNewTaskOpen(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCreateNewTask} disabled={ntBusy} className="btn-primary flex-1">
                {ntBusy ? 'A criar…' : 'Criar OT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create task from plan modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPlan(null)} />
          <div className="card relative w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Criar OT do plano</h2>
              <button onClick={() => setSelectedPlan(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-gray-50 dark:bg-slate-900/60 p-3 text-sm text-gray-700 dark:text-slate-300">
              <p className="font-medium">{selectedPlan.title}</p>
              {selectedPlan.description && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{selectedPlan.description}</p>}
            </div>

            {selectedPlan.safetyRules && selectedPlan.safetyRules.length > 0 && (
              <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-4 py-3">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-500 flex items-center gap-1.5 mb-1">
                  <ShieldAlert className="h-4 w-4" /> Regras de segurança
                </p>
                <ul className="space-y-0.5">
                  {selectedPlan.safetyRules.map((r, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-400">{i + 1}. {r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Prazo</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Atribuir a</label>
                <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="input">
                  <option value="">— nenhum —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            {createError && <p className="mt-3 text-sm text-red-600">{createError}</p>}
            {createSuccess && <p className="mt-3 text-sm text-green-600">OT criada com sucesso.</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelectedPlan(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCreateFromPlan} disabled={planBusy} className="btn-primary flex-1">
                {planBusy ? 'A criar…' : 'Criar OT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sincronização Calendário Gmail / Outlook */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSyncModal(false)} />
          <div className="card relative w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 text-blue-900 mb-1">
                  Sincronização Externa
                </span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  Sincronizar com Google Calendar / Outlook
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Subscreva o feed de calendário para ver todas as OTs e Manutenções no seu telemóvel (Android/iPhone) ou computador em tempo real.
                </p>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* URL do Feed iCal */}
            <div className="space-y-3 text-xs">
              <div className="bg-blue-50/70 dark:bg-blue-950/40 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/60 space-y-2">
                <label className="block text-xs font-bold text-blue-950 dark:text-blue-200">
                  URL do Feed iCal (.ics) - OTs & Manutenções RG
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/api/calendar/feed` : '/api/calendar/feed'}
                    className="input font-mono text-xs flex-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/api/calendar/feed`
                      navigator.clipboard.writeText(url)
                      setCopiedFeed(true)
                      setTimeout(() => setCopiedFeed(false), 2500)
                    }}
                    className="btn-primary flex items-center gap-1 text-xs py-2 px-3 whitespace-nowrap"
                  >
                    {copiedFeed ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedFeed ? 'Copiado!' : 'Copiar URL'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  Este link sincroniza automaticamente as tarefas em aberto e prevenções agendadas com a sua conta Google/Outlook.
                </p>
              </div>

              {/* Opções de Configuração Rápida */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Google Calendar */}
                <div className="card p-3.5 border border-slate-200 dark:border-slate-800 space-y-2 hover:border-blue-400 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                      G
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">Google Calendar (Gmail)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    1. Copie o URL do Feed acima.<br />
                    2. Abra o Google Calendar -&gt; <strong>Outros calendários (+)</strong> -&gt; <strong>A partir do URL</strong>.<br />
                    3. Cole o URL e guarde.
                  </p>
                  <button
                    onClick={() => window.open('https://calendar.google.com/calendar/u/0/r/settings/addbyurl', '_blank')}
                    className="w-full btn-secondary text-xs flex items-center justify-center gap-1.5 py-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir Google Calendar</span>
                  </button>
                </div>

                {/* Microsoft Outlook */}
                <div className="card p-3.5 border border-slate-200 dark:border-slate-800 space-y-2 hover:border-blue-400 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      O
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">Outlook / Office 365</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    1. Copie o URL do Feed acima.<br />
                    2. Abra o Outlook -&gt; <strong>Adicionar Calendário</strong> -&gt; <strong>Subscrever da Web</strong>.<br />
                    3. Cole o URL e guarde.
                  </p>
                  <button
                    onClick={() => window.open('https://outlook.live.com/calendar/0/addcalendar', '_blank')}
                    className="w-full btn-secondary text-xs flex items-center justify-center gap-1.5 py-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Abrir Outlook Web</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-slate-800">
              <button type="button" onClick={() => setShowSyncModal(false)} className="btn-primary px-6">
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão de Agendamentos */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header do Modal */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-industrial-blue" />
                <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                  Relatório de Agendamentos — {headerLabel}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-industrial-blue hover:bg-industrial-blue/90 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={16} /> <span>Imprimir / Gerar PDF</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Conteúdo Imprimível */}
            <div id="printable-calendar-report" className="p-6 overflow-y-auto space-y-4 bg-white text-slate-900">
              <style>{`
                @media print {
                  body * { visibility: hidden !important; }
                  #printable-calendar-report, #printable-calendar-report * { visibility: visible !important; }
                  #printable-calendar-report { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
                  .no-print { display: none !important; }
                }
              `}</style>

              <div className="border-b border-slate-300 pb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Relatório de Agendamentos de Manutenção</h1>
                  <p className="text-sm font-semibold text-slate-600 mt-0.5">Período: <span className="text-industrial-blue font-extrabold">{headerLabel}</span></p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 block">Emitido em: {new Date().toLocaleDateString('pt-PT')} {new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-xs font-extrabold text-industrial-blue">RG Maintenance OS</span>
                </div>
              </div>

              {/* Totalizadores de Impressão */}
              {(() => {
                const allEvents: { date: string; ev: CalendarEvent }[] = []
                eventMap.forEach((evList, dStr) => {
                  evList.forEach((ev) => allEvents.push({ date: dStr, ev }))
                })
                allEvents.sort((a, b) => a.date.localeCompare(b.date))
                const completedCount = allEvents.filter((item) => item.ev.type === 'task' && item.ev.task && (item.ev.task.status === 'done' || (item.ev.task.status as string) === 'completed')).length
                const pendingCount = allEvents.length - completedCount

                return (
                  <div>
                    <div className="grid grid-cols-3 gap-3 mb-4 text-xs font-bold">
                      <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-300">
                        <span className="text-slate-500 uppercase text-[10px]">Total Agendados</span>
                        <p className="text-lg font-black text-slate-800">{allEvents.length}</p>
                      </div>
                      <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                        <span className="text-amber-700 uppercase text-[10px]">Pendentes</span>
                        <p className="text-lg font-black text-amber-800">{pendingCount}</p>
                      </div>
                      <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                        <span className="text-emerald-700 uppercase text-[10px]">Concluídos</span>
                        <p className="text-lg font-black text-emerald-800">{completedCount}</p>
                      </div>
                    </div>

                    <table className="w-full text-left text-xs border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-200 text-slate-800 font-extrabold uppercase text-[10px]">
                          <th className="border border-slate-300 p-2">Data</th>
                          <th className="border border-slate-300 p-2">Tipo</th>
                          <th className="border border-slate-300 p-2">Equipamento / TAG</th>
                          <th className="border border-slate-300 p-2">Ação / Tarefa</th>
                          <th className="border border-slate-300 p-2">Técnico</th>
                          <th className="border border-slate-300 p-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium">
                        {allEvents.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400 italic">Nenhum agendamento registado para este período.</td>
                          </tr>
                        ) : (
                          allEvents.map(({ date, ev }, idx) => {
                            const isDone = ev.type === 'task' && ev.task && (ev.task.status === 'done' || (ev.task.status as string) === 'completed')
                            const assetObj = ev.task?.assetId ? assets.find(a => a.id === ev.task?.assetId) : ev.plan?.assetId ? assets.find(a => a.id === ev.plan?.assetId) : null
                            return (
                              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                <td className="border border-slate-300 p-2 font-bold whitespace-nowrap">{date}</td>
                                <td className="border border-slate-300 p-2 whitespace-nowrap uppercase font-bold text-[10px]">
                                  {ev.type === 'task' ? (TIPO_LABELS[ev.task?.tipo || 'preventiva'] || 'OT') : 'Plano'}
                                </td>
                                <td className="border border-slate-300 p-2">
                                  <div className="font-bold">{assetObj ? assetObj.name : assetName(ev.task?.assetId || ev.plan?.assetId)}</div>
                                  {assetObj?.tag && <div className="text-[10px] text-slate-500 font-mono">TAG: {assetObj.tag}</div>}
                                </td>
                                <td className="border border-slate-300 p-2 font-bold text-slate-900">{ev.label}</td>
                                <td className="border border-slate-300 p-2 whitespace-nowrap">{ev.task?.assignedTo ? userName(ev.task.assignedTo) : '—'}</td>
                                <td className="border border-slate-300 p-2 text-center whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isDone ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                                  }`}>
                                    {isDone ? 'Concluída' : 'Pendente'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
