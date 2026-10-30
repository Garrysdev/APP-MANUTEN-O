'use client'

import { useState, useMemo, useEffect, useRef, useTransition, useId } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, X, ShieldAlert, Power, PowerOff, Check, CheckCircle2,
  CalendarClock, Building2, Scale, ClipboardList, Upload, Download, ChevronLeft, ChevronRight, FileSpreadsheet, ChevronDown, Clock, PlayCircle
} from 'lucide-react'
import type {
  MaintenancePlan, TaskCriticidade, TipoTarefa, Periodicidade, PlanName, Task, TaskStatus
} from '@/types/models'
import {
  CRITICIDADE_LABELS, TIPO_LABELS, RECURRENCE_LABELS,
  PERIODICIDADE_LABELS, EXECUTOR_LABELS, STATUS_LABELS, statusBadgeClass,
} from '@/types/models'
import ExcelJS from 'exceljs'
import { addLogoToWorkbook } from '@/lib/export-logo'
import { useBranding } from '@/components/providers/BrandingProvider'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import { compareDates, toNormalizedIsoDate } from '@/lib/utils'
import {
  createMaintenancePlanAction,
  updateMaintenancePlanAction,
  deleteMaintenancePlanAction,
  toggleMaintenancePlanActiveAction,
  importMaintenancePlansAction,
  togglePlanCalendarAction,
  setPmOccurrenceStatusAction,
  setPlanNextDateAction,
  concludePmUntilAction,
} from './actions'
import { calculatePlanAnnualDates } from '@/lib/pm-generator'
import { findPlanLinkedTask, isPlanTask } from '@/lib/pm-status'
import { planCurrentDate, planRowStatus, isOpenLinkedTask, isOverdue, type PmRowStatus } from '@/lib/pm-schedule'
import { updateTaskStatusAction, updateTaskAction, loadStockRefsAction, type StockMaterialRef } from '../tasks/actions'
import { planHas, TEASER_LIMITS, type FeatureKey } from '@/lib/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { TipoBadge } from '@/components/ui/TipoBadge'
import CreateTaskModal from '@/components/modals/CreateTaskModal'
import { PREDEFINED_SAFETY_RULES } from '../tasks/TasksClient'
import ExcelDateFilter, { ExcelColumnDateFilter, ExcelDateFilterValues, DEFAULT_EXCEL_DATE_FILTER, filterByExcelDate } from '@/components/ui/ExcelDateFilter'
import MultiSelectPopoverFilter from '@/components/ui/MultiSelectPopoverFilter'
import Select from '@/components/ui/Select'

export function isPlanGanttActive(p: MaintenancePlan): boolean {
  if (p.includeInGantt !== undefined && p.includeInGantt !== null) {
    return p.includeInGantt
  }
  const label = (p.periodicidadeLabel || p.title || '').toUpperCase()
  if (
    p.periodicidade === 'bianual' ||
    label.includes('AGO') ||
    label.includes('DEZ') ||
    label.includes('PARAGEM') ||
    label.includes('PARAGENS') ||
    label.includes('STP')
  ) {
    return true
  }
  return false
}

function sanitizeCell(v: string): string {
  // neutraliza formula injection (=, +, -, @, tab, CR) ao abrir o CSV em Excel/Sheets
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

function toCSV(rows: string[][]): string {
  return rows
    .map((row) => row.map((v) => `"${sanitizeCell(String(v ?? '')).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
}

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return isoStr
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function downloadCSV(content: string, filename: string) {
  const bom = '﻿'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type Ref = { id: string; name: string; tag?: string | null }
type UserRef = Ref & {
  avatarUrl?: string | null
  active?: boolean
  abbreviation?: string | null
  role?: string | null
  isExternal?: boolean
  externalCompanyId?: string | null
  externalCompanyName?: string | null
}

const CRITICIDADE_DOT: Record<TaskCriticidade, string> = {
  vermelho: 'bg-red-500',
  amarelo: 'bg-yellow-400',
  verde: 'bg-green-500',
}

const PERIODICIDADE_OPTIONS: Periodicidade[] = ['semanal', 'mensal', 'trimestral', 'bianual', 'anual', 'bienal', 'trianual', 'horas', 'pontual']
const CRITICIDADE_OPTIONS: TaskCriticidade[] = ['vermelho', 'amarelo', 'verde']
const TIPO_OPTIONS: TipoTarefa[] = ['preventiva', 'curativa', 'plano', 'inspecao', 'lubrificacao', 'calibracao', 'outro']

/** Rótulo de periodicidade: usa a do plano (importada) ou deriva do motor de recorrência. */
function periodLabel(p: MaintenancePlan): string {
  if (p.periodicidade) return PERIODICIDADE_LABELS[p.periodicidade]
  const v = p.recurrenceValue > 1 ? `A cada ${p.recurrenceValue} ` : ''
  return `${v}${RECURRENCE_LABELS[p.recurrence]}`
}

export default function MaintenancePlanClient({
  plans,
  assets,
  users,
  tasks,
  plan,
}: {
  plans: MaintenancePlan[]
  assets: Ref[]
  users: UserRef[]
  tasks: Task[]
  plan: PlanName
}) {
  const router = useRouter()
  const { logoUrl } = useBranding()
  const { dict } = useLanguage()
  const [editing, setEditing] = useState<MaintenancePlan | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [safetyRules, setSafetyRules] = useState<string[]>([''])
  const [isPending, startTransition] = useTransition()
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [lockedFeature, setLockedFeature] = useState<FeatureKey | null>(null)
  const datalistId = useId()

  // Filtros por coluna (estilo Excel - alinhados com a folha PM)
  const emptyCol = { area: '', tag: '', system: '', asset: '', title: '', description: '', tipo: '', period: '', crit: '', executor: '', estado: '' }
  const [colF, setColF] = useState(emptyCol)
  const setCol = (k: keyof typeof emptyCol, v: string) => setColF((c) => ({ ...c, [k]: v }))
  const [excelDateFilter, setExcelDateFilter] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [fLegal, setFLegal] = useState(false)
  const [fCalendar, setFCalendar] = useState<'' | 'yes' | 'no'>('')
  const anyFilter = fLegal || Boolean(fCalendar) || Object.values(colF).some(Boolean) || JSON.stringify(excelDateFilter) !== JSON.stringify(DEFAULT_EXCEL_DATE_FILTER)
  function clearFilters() { setColF(emptyCol); setFLegal(false); setFCalendar(''); setExcelDateFilter(DEFAULT_EXCEL_DATE_FILTER) }

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets])
  const assetTagMap = useMemo(() => new Map(assets.map((a) => [a.id, a.tag || ''])), [assets])
  const getPlanTag = (p: MaintenancePlan) => p.tag || (p.assetId ? assetTagMap.get(p.assetId) || '' : '')

  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTipos, setSelectedTipos] = useState<string[]>([])
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([])
  const [selectedCrits, setSelectedCrits] = useState<string[]>([])

  // Áreas únicas dos planos
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>()
    plans.forEach((p) => {
      if (p.area && p.area.trim()) set.add(p.area.trim())
    })
    return Array.from(set).sort()
  }, [plans])

  // TAGs únicas em cascata com a ÁREA selecionada
  const availableTags = useMemo(() => {
    const set = new Set<string>()
    const activeAreas = selectedAreas.map((a) => a.trim().toLowerCase())
    plans.forEach((p) => {
      if (activeAreas.length > 0 && !(p.area && activeAreas.includes(p.area.trim().toLowerCase()))) {
        return
      }
      const t = getPlanTag(p)
      if (t && t.trim()) set.add(t.trim())
    })
    return Array.from(set).sort()
  }, [plans, selectedAreas, assetTagMap])

  const assetName = (id?: string | null) => (id ? assetMap.get(id) ?? '—' : '—')
  const userName = (id?: string | null) => (id ? users.find((u) => u.id === id)?.name ?? '—' : '—')

  function openCreate() {
    if (!planHas(plan, 'maintenance-plan') && plans.length >= TEASER_LIMITS['maintenance-plan']) {
      setLockedFeature('maintenance-plan')
      return
    }
    setEditing(null)
    setSafetyRules([''])
    setError('')
    setCreating(true)
  }
  function openEdit(plan: MaintenancePlan) {
    setEditing(plan)
    setSafetyRules(plan.safetyRules?.length ? plan.safetyRules : [''])
    setError('')
    setCreating(true)
  }
  function closeModal() {
    setCreating(false)
    setEditing(null)
    setError('')
    setSafetyRules([''])
  }

  // Carrega o Stock sob demanda (1×) quando o modal de criação/edição do PM abre
  const [stockRefs, setStockRefs] = useState<StockMaterialRef[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [stockLoaded, setStockLoaded] = useState(false)

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

  // Se o plano já tem OTs geradas no calendário, clicar na linha deve abrir a mesma
  // janela de edição das OT (com as datas e a opção de concluir), não o editor do
  // plano-modelo. Só cai no editor de plano quando ainda não há nenhuma OT associada.
  const [viewingTask, setViewingTask] = useState<Task | null>(null)

  // Carrega o stock só quando um dos modais abre. Tem de vir depois de viewingTask
  // ser declarado, senão é usado antes da declaração.
  useEffect(() => {
    if (creating || Boolean(editing) || Boolean(viewingTask)) {
      void ensureStockLoaded()
    }
  }, [creating, editing, viewingTask])

  // Seletor de ano da tabela do PM — permite ver as OT geradas em anos anteriores
  // e futuros, não só o ano corrente.
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  function findPlanTask(p: MaintenancePlan, year: number = selectedYear): Task | null {
    return findPlanLinkedTask(p, tasks, year)
  }
  const todayYMD = new Date().toISOString().slice(0, 10)
  // OT atual do plano (pm-schedule.ts): a data da próxima execução e o estado dessa OT.
  // Uma OT concluída de uma execução anterior já não conta — a atual é a seguinte.
  type PlanInfo = { linked: Task | null; current: string | null; status: PmRowStatus; overdue: boolean }
  function computePlanInfo(p: MaintenancePlan): PlanInfo {
    const linked = findPlanTask(p)
    const current = planCurrentDate(p, todayYMD, linked?.status === 'done' ? linked.completedAt : null)
    const status = planRowStatus(linked, current)
    return { linked, current, status, overdue: status !== 'done' && isOverdue(current, todayYMD) }
  }
  // Calculado uma vez por plano (filtros, ordenação e linhas usam-no muitas vezes).
  const planInfoById = useMemo(
    () => new Map(plans.map((p) => [p.id, computePlanInfo(p)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plans, tasks, selectedYear, todayYMD],
  )
  function planInfo(p: MaintenancePlan): PlanInfo {
    return planInfoById.get(p.id) ?? computePlanInfo(p)
  }
  // Histórico do plano (ficha): OT de PM concluídas + execuções concluídas em bloco.
  function planHistory(p: MaintenancePlan): { key: string; date: string; doneAt: string; label: string }[] {
    const fromTasks = tasks
      .filter((t) => t.status === 'done' && isPlanTask(p, t))
      .map((t) => ({
        key: t.id,
        date: (t.dueDate || t.plannedStartDate || t.completedAt || '').slice(0, 10),
        doneAt: (t.completedAt || '').slice(0, 10),
        label: t.otNumber ? `OT ${t.otNumber}` : 'OT',
      }))
    const taskIds = new Set(fromTasks.map((h) => h.key))
    const fromPlan = (p.executionHistory || [])
      .filter((e) => !e.taskId || !taskIds.has(e.taskId))
      .map((e, i) => ({ key: `h${i}`, date: e.date, doneAt: e.doneAt, label: e.bulk ? 'Concluída em bloco' : 'OT' }))
    return [...fromTasks, ...fromPlan].sort((a, b) => (b.doneAt || b.date).localeCompare(a.doneAt || a.date))
  }
  function matchesEstado(p: MaintenancePlan, estado: string): boolean {
    if (!estado) return true
    const { status, overdue } = planInfo(p)
    if (estado === 'atraso') return overdue
    return status === estado
  }

  // Coluna PRÓXIMA: muda a data da OT atual (a mesma do Calendário).
  const [editingDatePlanId, setEditingDatePlanId] = useState<string | null>(null)
  async function handleSetNextDate(planId: string, date: string) {
    setEditingDatePlanId(null)
    if (!date) return
    const res = await setPlanNextDateAction(planId, date)
    if (res?.error) alert(res.error)
    else router.refresh()
  }
  function renderNextDate(p: MaintenancePlan) {
    const { current, status, overdue } = planInfo(p)
    if (editingDatePlanId === p.id) {
      return (
        <input
          type="date"
          autoFocus
          defaultValue={current || ''}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => handleSetNextDate(p.id, e.target.value === current ? '' : e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setEditingDatePlanId(null)
          }}
          className="w-full rounded border border-slate-300 px-1 py-0.5 text-[10px] font-mono"
        />
      )
    }
    if (!current || status === 'done') return <span className="text-slate-400">—</span>
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEditingDatePlanId(p.id) }}
        title={overdue ? 'Em atraso — clique para mudar a data (também muda no Calendário)' : 'Clique para mudar a data (também muda no Calendário)'}
        className={`inline-flex items-center gap-1 px-1 py-0.5 rounded font-mono font-bold text-[10px] cursor-pointer ${overdue ? 'bg-red-600 text-white' : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
      >
        <CalendarClock className="h-3 w-3 shrink-0" /> {formatDate(current)}
      </button>
    )
  }

  // Dar como concluídas as OT de PM até uma data, de uma vez: primeiro conta, depois confirma.
  const [concludingUntil, setConcludingUntil] = useState(false)
  async function handleConcludeUntil() {
    const d = new Date()
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const suggestion = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`
    const until = prompt('Dar como concluídas as OT de PM com data até (AAAA-MM-DD):', suggestion)
    if (!until) return
    setConcludingUntil(true)
    const preview = await concludePmUntilAction(until, true)
    if (preview.error) { setConcludingUntil(false); alert(preview.error); return }
    if (!confirm(`${preview.plans} plano(s) com OT até ${formatDate(until)} passam para a próxima data, e ${preview.tasks} OT de PM aberta(s) ficam Concluídas. Continuar?`)) {
      setConcludingUntil(false)
      return
    }
    const res = await concludePmUntilAction(until, false)
    setConcludingUntil(false)
    if (res.error) alert(res.error)
    else router.refresh()
  }
  function openPlanRow(p: MaintenancePlan) {
    openEdit(p)
  }

  // Botão dinâmico da coluna TAREFA: Pendente -> Em Curso -> Concluída
  const [concludingPlanId, setConcludingPlanId] = useState<string | null>(null)
  const [statusMenuPlanId, setStatusMenuPlanId] = useState<string | null>(null)
  async function handleSetPmStatus(planId: string, status: TaskStatus) {
    setStatusMenuPlanId(null)
    setConcludingPlanId(planId)
    // A OT que a linha mostra — é essa que muda de estado (ver setMaintenancePlanOccurrenceStatus).
    const pmPlan = plans.find((x) => x.id === planId)
    const linkedTask = pmPlan ? findPlanTask(pmPlan) : null
    // Uma OT já concluída é da execução anterior: a OT atual nasce no servidor, na próxima data.
    const res = await setPmOccurrenceStatusAction(planId, status, isOpenLinkedTask(linkedTask) ? linkedTask!.id : undefined)
    setConcludingPlanId(null)
    if (res?.error) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  // Mesmas cores e nomes dos estados das OT (badge-* em globals.css).
  const PM_STATUS_ICONS: Record<PmRowStatus, typeof Clock> = { pending: Clock, in_progress: PlayCircle, done: CheckCircle2 }

  // Botão dinâmico de estado da tarefa: mostra o estado atual e, ao clicar,
  // revela só as transições válidas a partir daí (Pendente -> Em Curso | Concluída;
  // Em Curso -> Concluir). É este estado que também alimenta o filtro "Estado da Tarefa".
  function renderPmStatusButton(p: MaintenancePlan) {
    const { status } = planInfo(p)
    const isOpen = statusMenuPlanId === p.id
    const isBusy = concludingPlanId === p.id
    const label = STATUS_LABELS[status]
    const cls = statusBadgeClass(status)
    const Icon = PM_STATUS_ICONS[status]

    if (status === 'done') {
      return (
        <span className={`${cls} !px-1.5 !text-[9px] gap-1`}>
          <Icon className="h-3 w-3" /> {label}
        </span>
      )
    }

    return (
      <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setStatusMenuPlanId(isOpen ? null : p.id)}
          title="Alterar estado desta ocorrência"
          className={`${cls} !px-1.5 !text-[9px] gap-1 transition-colors disabled:opacity-50 cursor-pointer hover:brightness-110`}
        >
          <Icon className="h-3 w-3" />
          {isBusy ? 'A atualizar…' : label}
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
        {isOpen && (
          <div className="absolute z-20 top-full left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[112px] overflow-hidden">
            {status === 'pending' && (
              <>
                <button
                  type="button"
                  onClick={() => handleSetPmStatus(p.id, 'in_progress')}
                  className="w-full text-left px-2.5 py-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Em Curso
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPmStatus(p.id, 'done')}
                  className="w-full text-left px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Concluída
                </button>
              </>
            )}
            {status === 'in_progress' && (
              <button
                type="button"
                onClick={() => handleSetPmStatus(p.id, 'done')}
                className="w-full text-left px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Concluir
              </button>
            )}
          </div>
        )}
      </div>
    )
  }
  function addRule() { setSafetyRules((r) => [...r, '']) }
  function removeRule(i: number) { setSafetyRules((r) => r.filter((_, idx) => idx !== i)) }
  function updateRule(i: number, v: string) { setSafetyRules((r) => r.map((x, idx) => idx === i ? v : x)) }

  // Modal de Agendamento no Calendário
  const [calendarModalPlan, setCalendarModalPlan] = useState<MaintenancePlan | null>(null)
  const [calendarStartDate, setCalendarStartDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [customCalendarDates, setCustomCalendarDates] = useState<string[]>([])
  const [savingCalendar, setSavingCalendar] = useState(false)

  function openCalendarModal(p: MaintenancePlan) {
    setCalendarModalPlan(p)
    const initialStart = p.calendarStartDate || new Date().toISOString().slice(0, 10)
    setCalendarStartDate(initialStart)

    if (p.calendarDates && p.calendarDates.length > 0) {
      setCustomCalendarDates(p.calendarDates)
    } else {
      const initialDates = calculatePlanAnnualDates(p, new Date().getFullYear())
      setCustomCalendarDates(initialDates.length > 0 ? initialDates : [initialStart])
    }
  }

  function handleStartDateChange(newStart: string) {
    setCalendarStartDate(newStart)
    if (!calendarModalPlan) return
    const period = calendarModalPlan.periodicidade || 'mensal'
    let count = customCalendarDates.length || (period === 'bianual' ? 2 : period === 'trimestral' ? 4 : period === 'anual' ? 1 : 12)
    const newDates: string[] = []
    const start = new Date(newStart)
    for (let i = 0; i < count; i++) {
      const d = new Date(start)
      if (period === 'semanal') d.setDate(d.getDate() + i * 7)
      else if (period === 'mensal') d.setMonth(d.getMonth() + i)
      else if (period === 'trimestral') d.setMonth(d.getMonth() + i * 3)
      else if (period === 'bianual') d.setMonth(d.getMonth() + i * 6)
      else if (period === 'anual') d.setFullYear(d.getFullYear() + i)
      else if (period === 'bienal') d.setFullYear(d.getFullYear() + i * 2)
      else if (period === 'trianual') d.setFullYear(d.getFullYear() + i * 3)
      else if (period === 'horas') d.setMonth(d.getMonth() + i)
      else if (period === 'pontual') { if (i > 0) break }
      newDates.push(d.toISOString().slice(0, 10))
    }
    setCustomCalendarDates(newDates)
  }

  async function handleConfirmCalendarSchedule() {
    if (!calendarModalPlan) return
    setSavingCalendar(true)
    await togglePlanCalendarAction(
      calendarModalPlan.id,
      true,
      customCalendarDates[0] || calendarStartDate,
      customCalendarDates
    )
    setSavingCalendar(false)
    setCalendarModalPlan(null)
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const cleanRules = safetyRules.filter((r) => r.trim())
    fd.set('safetyRules', JSON.stringify(cleanRules.length ? cleanRules : []))
    if (editing) fd.set('id', editing.id)
    const result = editing
      ? await updateMaintenancePlanAction({}, fd)
      : await createMaintenancePlanAction({}, fd)
    setBusy(false)
    if (result?.error) {
      setError(result.error)
    } else {
      closeModal()
      router.refresh()
    }
  }

  async function handleDelete(plan: MaintenancePlan) {
    if (!confirm(`Eliminar o plano "${plan.title}"?`)) return
    setBusy(true)
    const res = await deleteMaintenancePlanAction(plan.id)
    setBusy(false)
    if (res?.error) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  function handleToggleActive(plan: MaintenancePlan) {
    startTransition(async () => {
      await toggleMaintenancePlanActiveAction(plan.id, !plan.active)
      router.refresh()
    })
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!planHas(plan, 'maintenance-plan') && plans.length >= TEASER_LIMITS['maintenance-plan']) {
      setLockedFeature('maintenance-plan')
      return
    }
    setImporting(true)
    setImportError('')
    setImportResult(null)
    const fd = new FormData()
    fd.set('file', file)
    const result = await importMaintenancePlansAction(fd)
    setImporting(false)
    if (result.error) setImportError(result.error)
    else {
      setImportResult({ created: result.created ?? 0, skipped: result.skipped ?? 0 })
      router.refresh()
    }
  }

  async function handleExportXLS() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Plano de Manutenção', { views: [{ showGridLines: true }] })

    sheet.mergeCells('A1:M1')
    const titleCell = sheet.getCell('A1')
    titleCell.value = 'PL-MAN-01 PLANO DE MANUTENÇÃO PREVENTIVA'
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    sheet.getRow(1).height = 32

    const headers = ['ÁREA', 'TAG', 'SISTEMA', 'EQUIPAMENTO', 'AÇÃO / TAREFA', 'DESCRIÇÃO', 'PERIODICIDADE', 'CRITICIDADE', 'TÉCNICO', 'OBRIGATÓRIA (LEGAL)', 'REGRAS DE SEGURANÇA', 'PRÓXIMA DATA / AGENDAMENTO', 'ESTADO']
    const headerRow = sheet.getRow(3)
    headerRow.values = headers
    headerRow.height = 26
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    const sortedPlans = [...shown].sort((a, b) =>
      compareDates(a.nextDueDate || a.calendarStartDate || a.createdAt, b.nextDueDate || b.calendarStartDate || b.createdAt)
    )

    sortedPlans.forEach((p) => {
      const row = sheet.addRow([
        p.area ?? '—',
        getPlanTag(p) || '—',
        p.system ?? '—',
        assetName(p.assetId) || 'Vários / Geral',
        p.title,
        p.description ?? '—',
        periodLabel(p),
        CRITICIDADE_LABELS[p.criticidade] || p.criticidade,
        p.executor ? EXECUTOR_LABELS[p.executor] : EXECUTOR_LABELS.interno,
        p.legal ? 'SIM' : 'NÃO',
        p.safetyRules ? p.safetyRules.join('; ') : '—',
        planInfo(p).current ? formatDate(planInfo(p).current) : '—',
        STATUS_LABELS[planInfo(p).status],
      ])
      row.height = 20
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9 }
      })
    })

    sheet.columns.forEach((col) => {
      let maxLen = 10
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value || '').length
        if (len > maxLen && len < 50) maxLen = len
      })
      col.width = Math.max(maxLen + 4, 10)
    })

    await addLogoToWorkbook(workbook, logoUrl)
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().split('T')[0]
    a.href = url
    a.download = `PL-MAN-01_PLANO_MANUTENCAO_${date}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filtragem por coluna (estilo Excel) ──
  const norm = (s: string | null | undefined) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  const inc = (val: string | null | undefined, f: string) =>
    !f || norm(val).includes(norm(f))


  const filtered = useMemo(() => {
    return plans.filter((p) => {
      // Filtro de datas da coluna PRÓXIMA (a data da OT atual do plano).
      if (!filterByExcelDate(planInfo(p).current, excelDateFilter)) return false
      
      // Filtros Multi-Seleção
      if (selectedAreas.length > 0) {
        if (!selectedAreas.some((a) => norm(p.area) === norm(a))) return false
      } else if (colF.area && norm(p.area) !== norm(colF.area)) return false

      if (selectedTags.length > 0) {
        if (!selectedTags.some((t) => norm(getPlanTag(p)) === norm(t))) return false
      } else if (colF.tag && norm(getPlanTag(p)) !== norm(colF.tag)) return false

      if (selectedTipos.length > 0) {
        if (!selectedTipos.some((tp) => (p.tipo || '').toLowerCase() === tp.toLowerCase())) return false
      } else if (colF.tipo && (p.tipo || '').toLowerCase() !== colF.tipo.toLowerCase()) return false

      if (selectedPeriods.length > 0) {
        if (!selectedPeriods.some((pr) => (p.periodicidade || '').toLowerCase() === pr.toLowerCase())) return false
      } else if (colF.period && !inc(periodLabel(p), colF.period)) return false

      if (selectedCrits.length > 0) {
        if (!selectedCrits.includes(p.criticidade)) return false
      } else if (colF.crit && p.criticidade !== colF.crit) return false

      if (!inc(p.system, colF.system)) return false
      if (!inc(assetName(p.assetId), colF.asset)) return false
      if (!inc(p.title, colF.title)) return false
      if (!inc(p.description, colF.description)) return false
      if (colF.executor && (p.executor ?? 'interno') !== colF.executor) return false
      if (!matchesEstado(p, colF.estado)) return false
      if (fLegal && !p.legal) return false

      const isCal = Boolean(p.showInCalendar || (p.calendarDates && p.calendarDates.length > 0) || p.active !== false)
      if (fCalendar === 'yes' && !isCal) return false
      if (fCalendar === 'no' && isCal) return false

      return true
    })
  }, [plans, tasks, colF, selectedAreas, selectedTags, selectedTipos, selectedPeriods, selectedCrits, fLegal, fCalendar, assetMap, assetTagMap, excelDateFilter, selectedYear, planInfoById])

  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  useEffect(() => { setCurrentPage(1) }, [colF, fLegal, pageSize, excelDateFilter])

  const { sorted: shown, sortKey, sortDir, toggleSort } = useTableSort<MaintenancePlan>(
    filtered,
    {
      area: (p) => p.area ?? null,
      tag: (p) => getPlanTag(p),
      system: (p) => p.system ?? null,
      asset: (p) => assetName(p.assetId),
      title: (p) => p.title?.toLowerCase(),
      description: (p) => p.description?.toLowerCase() ?? null,
      period: (p) => periodLabel(p),
      crit: (p) => p.criticidade,
      executor: (p) => (p.executor ? EXECUTOR_LABELS[p.executor] : ''),
      estado: (p) => ({ pending: 0, in_progress: 1, done: 2 } as const)[planInfo(p).status],
      proxima: (p) => planInfo(p).current,
      data: (p) => toNormalizedIsoDate(p.nextDueDate || p.calendarStartDate || p.createdAt),
    },
    'title',
  )

  const effectivePageSize = pageSize === -1 ? (shown.length || 1) : pageSize
  const totalPages = Math.ceil(shown.length / effectivePageSize) || 1
  const currentShown = useMemo(() => {
    if (pageSize === -1) return shown
    return shown.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  }, [shown, currentPage, pageSize])

  const colFilterCls = 'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-safety-orange shadow-sm'

  return (
    <div>
      {lockedFeature && (
        <UpgradeModal feature={lockedFeature} isTeaser={true} onClose={() => setLockedFeature(null)} />
      )}
      {/* A OT gerada por este plano é editada no modal único no fim deste ficheiro,
          que já trata dos três casos (ver OT de PM, editar plano, criar plano). Havia
          aqui uma segunda instância que abria em simultâneo com essa, empilhando dois
          modais iguais — sem título próprio e sem a ação de gravação correta. */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 shrink-0">
          {shown.length} / {plans.length}
        </p>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 mr-2">
            <span>Por página:</span>
            <Select sort={false}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="input text-xs py-1 px-2 w-auto"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={-1}>Todos ({plans.length})</option>
            </Select>
          </div>
          <button
            onClick={() => {
              window.open('/api/backup/excel?type=plan', '_blank')
              setTimeout(() => {
                window.open('/api/backup/excel?type=tasks', '_blank')
              }, 500)
            }}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
            title="Descarregar ficheiros de backup Excel de Plano de Manutenção (PL-MAN-01) e Histórico de OTs (FR-MAN-09)"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0" />
            <span>Backup Excel (Planos + OTs)</span>
          </button>
          <button onClick={handleExportXLS} className="btn-secondary flex items-center gap-1.5 cursor-pointer">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="hidden sm:inline">Exportar Excel (.xls)</span>
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="btn-secondary flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{importing ? dict.common.importing : dict.common.import}</span>
          </button>
          <input ref={importInputRef} type="file" accept=".xls,.xlsx" onChange={handleImportFile} className="hidden" />
          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-1 py-1" title="Ver as OT do PM geradas noutro ano (anteriores ou posteriores)">
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y - 1)}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Ano anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-bold text-gray-700 dark:text-slate-200 px-1.5 min-w-[3.5rem] text-center">{selectedYear}</span>
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y + 1)}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Ano seguinte"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {selectedYear !== new Date().getFullYear() && (
              <button
                type="button"
                onClick={() => setSelectedYear(new Date().getFullYear())}
                className="ml-1 text-[9px] font-bold text-[#2E86C1] hover:underline cursor-pointer pr-1"
              >
                hoje
              </button>
            )}
          </div>
          <button
            onClick={handleConcludeUntil}
            disabled={concludingUntil}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Dar como concluídas as OT de PM até uma data — cada plano passa para a próxima data"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{concludingUntil ? 'A concluir…' : 'Concluir PM até…'}</span>
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
            <Plus className="h-4 w-4 shrink-0" />
            <span>Criar Tarefa</span>
          </button>
        </div>
      </div>

      {importError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 font-medium">
          {importError}
        </div>
      )}
      {importResult && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between text-xs text-green-800 font-medium">
          <span>
            Importação concluída: {importResult.created} planos criados{importResult.skipped > 0 ? `, ${importResult.skipped} ignorados (duplicados)` : ''}.
          </span>
          <button onClick={() => setImportResult(null)} className="text-green-500 hover:text-green-700 dark:hover:text-emerald-300 flex-shrink-0" aria-label="Dispensar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filtros por estado, Calendário e Gantt */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'pending', label: STATUS_LABELS.pending },
            { key: 'in_progress', label: STATUS_LABELS.in_progress },
            { key: 'done', label: STATUS_LABELS.done },
            { key: 'atraso', label: 'Em atraso' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCol('estado', key === 'todos' ? '' : key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                (colF.estado === key || (key === 'todos' && !colF.estado))
                  ? 'bg-[#1B4F72] text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtro Calendário */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
          <span className="px-2 font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <CalendarClock size={14} className="text-safety-orange" /> Calendário:
          </span>
          <button
            onClick={() => setFCalendar('')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              !fCalendar ? 'bg-[#1B4F72] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFCalendar('yes')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              fCalendar === 'yes' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            ✓ No Calendário
          </button>
          <button
            onClick={() => setFCalendar('no')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              fCalendar === 'no' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            Fora do Calendário
          </button>
        </div>

      </div>

      {/* Barra de filtros: checkbox legais + limpar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-900 font-bold cursor-pointer select-none bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-sm hover:bg-slate-50">
          <input type="checkbox" checked={fLegal} onChange={(e) => setFLegal(e.target.checked)} className="rounded border-slate-300 text-safety-orange focus:ring-safety-orange w-3.5 h-3.5" />
          <Scale className="h-3.5 w-3.5 text-red-600" />
          <span>Só legais</span>
        </label>
        {/* Sempre visível (não só quando há filtros ativos) — pedido do Rui para não ter de
            adivinhar se algum filtro ficou esquecido ligado noutra sessão/página. */}
        <button
          onClick={clearFilters}
          disabled={!anyFilter}
          className="flex items-center gap-1 text-xs text-red-600 hover:underline font-bold disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
        >
          <X className="h-3.5 w-3.5" /> Limpar filtros
        </button>
        <span className="text-xs font-semibold text-slate-700 ml-auto">Filtra por coluna na linha abaixo dos títulos (estilo Excel).</span>
      </div>

      {/* Vista em cartões — telemóvel e tablet (a tabela completa fica só para ecrãs md+) */}
      <div className="md:hidden space-y-2.5">
        {currentShown.length === 0 ? (
          <div className="card px-5 py-12 text-center text-slate-400 border border-slate-200 dark:border-slate-800">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{dict.maintenancePlan.empty}</p>
          </div>
        ) : (
          currentShown.map((p) => {
            const t = findPlanTask(p)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openPlanRow(p)}
                className={`card w-full text-left border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 active:bg-blue-50/70 dark:active:bg-slate-800/80 transition-colors cursor-pointer ${!p.active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <TipoBadge tipo={p.tipo || 'plano'} codeOnly={true} />
                    {p.assetId || getPlanTag(p) ? (
                      <Link
                        href={`/dashboard/assets/${encodeURIComponent(p.assetId || getPlanTag(p))}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-industrial-blue dark:text-blue-400 hover:text-safety-orange hover:underline truncate"
                        title="Ver ficha do equipamento"
                      >
                        {getPlanTag(p) || '—'}
                      </Link>
                    ) : (
                      <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 truncate">{getPlanTag(p) || '—'}</span>
                    )}
                    <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 truncate">{p.area || '—'}</span>
                  </div>
                  <span className="shrink-0" onClick={(e) => e.stopPropagation()}>{renderPmStatusButton(p)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2 flex-1">{p.title}</p>
                  {p.legal && (
                    <span title="Inspeção legal/obrigatória" className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[9px] text-red-800 font-bold border border-red-300 shrink-0">
                      <Scale className="h-2.5 w-2.5" /> Legal
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  {p.assetId ? (
                    <Link
                      href={`/dashboard/assets/${encodeURIComponent(p.assetId)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-industrial-blue dark:text-blue-400 hover:text-safety-orange hover:underline font-semibold"
                      title="Ver ficha do equipamento"
                    >
                      {assetName(p.assetId)}
                    </Link>
                  ) : (
                    assetName(p.assetId)
                  )}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      <CalendarClock className="h-3 w-3 text-slate-500 shrink-0" /> {periodLabel(p)}
                    </span>
                    {p.executor === 'externo' && (
                      <span className="inline-flex items-center gap-0.5 font-bold text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200"><Building2 className="h-3 w-3" /> Ext.</span>
                    )}
                  </div>
                  <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Próxima:</span>
                    {renderNextDate(p)}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>

      <div className="hidden md:block card overflow-x-auto shadow-lg border border-slate-200 dark:border-slate-800">
        {shown.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{dict.maintenancePlan.empty}</p>
          </div>
        ) : (
          <table className="w-full text-[11px] min-w-[860px] table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                <SortableTh label="ÁREA" sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[50px] px-1 py-1.5 whitespace-nowrap text-left" />
                <SortableTh label="TAG" sortableKey="tag" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[70px] px-1 py-1.5 whitespace-nowrap text-left" />
                <SortableTh label="SISTEMA" sortableKey="system" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[70px] px-1 py-1.5 whitespace-nowrap text-left" />
                <SortableTh label="EQUIPAMENTO" sortableKey="asset" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[110px] px-1 py-1.5 text-left" />
                <SortableTh label="AÇÃO / TAREFA" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[140px] px-1 py-1.5 text-left" />
                <SortableTh label="TIPO" sortableKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[115px] px-1 py-1.5 text-left" />
                <SortableTh label="PERIODICIDADE" sortableKey="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[100px] px-1 py-1.5 text-left" />
                <SortableTh label="CAT" sortableKey="crit" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[45px] px-1 py-1.5 whitespace-nowrap text-left" />
                <SortableTh label="TÉCNICO" sortableKey="executor" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[55px] px-1 py-1.5 whitespace-nowrap text-left" />
                <SortableTh label="ESTADO" sortableKey="estado" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[85px] px-1 py-1.5 whitespace-nowrap text-left" />
                <SortableTh label="PRÓXIMA" sortableKey="proxima" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[85px] px-1 py-1.5 whitespace-nowrap text-left" />
              </tr>
              {/* Linha de filtros por coluna (estilo Excel) */}
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-0.5 py-0.5">
                  <MultiSelectPopoverFilter
                    label="Área"
                    options={uniqueAreas.map((a) => ({ value: a, label: a }))}
                    selectedValues={selectedAreas}
                    onChange={setSelectedAreas}
                    placeholder="Área (Todas)"
                  />
                </th>
                <th className="px-0.5 py-0.5">
                  <MultiSelectPopoverFilter
                    label="TAG"
                    options={availableTags.map((t) => ({ value: t, label: t }))}
                    selectedValues={selectedTags}
                    onChange={setSelectedTags}
                    placeholder="TAG (Todas)"
                  />
                </th>
                <th className="px-0.5 py-0.5">
                  <input value={colF.system} onChange={(e) => setCol('system', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-0.5 py-0.5">
                  <input value={colF.asset} onChange={(e) => setCol('asset', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-0.5 py-0.5">
                  <input value={colF.title} onChange={(e) => setCol('title', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-0.5 py-0.5">
                  <MultiSelectPopoverFilter
                    label="Tipo"
                    options={Object.entries(TIPO_LABELS).map(([k, label]) => ({ value: k, label }))}
                    selectedValues={selectedTipos}
                    onChange={setSelectedTipos}
                    placeholder="Tipo (Todos)"
                  />
                </th>
                <th className="px-0.5 py-0.5">
                  <MultiSelectPopoverFilter
                    label="Periodicidade"
                    options={Object.entries(PERIODICIDADE_LABELS).map(([k, label]) => ({ value: k, label }))}
                    selectedValues={selectedPeriods}
                    onChange={setSelectedPeriods}
                    placeholder="Todas"
                  />
                </th>
                <th className="px-0.5 py-0.5">
                  <MultiSelectPopoverFilter
                    label="Criticidade"
                    options={Object.entries(CRITICIDADE_LABELS).map(([k, label]) => ({ value: k, label }))}
                    selectedValues={selectedCrits}
                    onChange={setSelectedCrits}
                    placeholder="Todas"
                  />
                </th>
                <th className="px-0.5 py-0.5">
                  <Select value={colF.executor} onChange={(e) => setCol('executor', e.target.value)} className={colFilterCls} title="Filtrar executor">
                    <option value="">Todos</option>
                    <option value="interno">Interno</option>
                    <option value="externo">Externo</option>
                  </Select>
                </th>
                <th className="px-0.5 py-0.5">
                  <Select sort={false} value={colF.estado} onChange={(e) => setCol('estado', e.target.value)} className={colFilterCls} title="Filtrar estado da OT">
                    <option value="">Todos</option>
                    <option value="pending">{STATUS_LABELS.pending}</option>
                    <option value="in_progress">{STATUS_LABELS.in_progress}</option>
                    <option value="done">{STATUS_LABELS.done}</option>
                    <option value="atraso">Em atraso</option>
                  </Select>
                </th>
                <th className="px-0.5 py-0.5 relative">
                  <ExcelColumnDateFilter values={excelDateFilter} onChange={setExcelDateFilter} />
                </th>
              </tr>
            </thead>
            <tbody>
              {currentShown.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => openPlanRow(p)}
                  className={`border-b border-slate-100 hover:bg-blue-50/70 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group ${!p.active ? 'opacity-50' : ''}`}
                  title={tasks.some((t) => t.maintenancePlanId === p.id) ? 'Clique para abrir a OT desta ocorrência no calendário' : 'Clique para abrir e editar este Plano de Manutenção'}
                >
                  <td className="px-1 py-1.5 font-mono font-bold text-slate-900 whitespace-nowrap">{p.area || '—'}</td>
                  <td className="px-1 py-1.5 font-mono font-bold text-slate-900 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {p.assetId || getPlanTag(p) ? (
                      <Link
                        href={`/dashboard/assets/${encodeURIComponent(p.assetId || getPlanTag(p))}`}
                        className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-industrial-blue dark:text-blue-400 hover:text-safety-orange hover:border-safety-orange hover:bg-orange-50 font-bold transition-colors inline-block"
                        title="Ver ficha do equipamento"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {getPlanTag(p) || '—'}
                      </Link>
                    ) : (
                      <span className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{getPlanTag(p) || '—'}</span>
                    )}
                  </td>
                  <td className="px-1 py-1.5 text-slate-800 font-semibold whitespace-nowrap">{p.system || '—'}</td>
                  <td className="px-1 py-1.5 text-slate-900 font-bold max-w-[110px]" onClick={(e) => e.stopPropagation()}>
                    {p.assetId ? (
                      <Link
                        href={`/dashboard/assets/${encodeURIComponent(p.assetId)}`}
                        className="line-clamp-2 text-industrial-blue dark:text-blue-400 hover:text-safety-orange hover:underline transition-colors"
                        title={assetName(p.assetId)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {assetName(p.assetId)}
                      </Link>
                    ) : (
                      <span className="line-clamp-2" title={assetName(p.assetId)}>{assetName(p.assetId)}</span>
                    )}
                  </td>
                  <td className="px-1 py-1.5 font-bold text-slate-900 max-w-[140px]">
                    <div className="flex items-center gap-1">
                      <span className="line-clamp-2 group-hover:text-industrial-blue group-hover:underline transition-colors" title={p.title}>{p.title}</span>
                      {p.legal && (
                        <span title="Inspeção legal/obrigatória" className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[9px] text-red-800 font-bold border border-red-300 shrink-0">
                          <Scale className="h-2.5 w-2.5" /> Legal
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-1.5">
                    <TipoBadge tipo={p.tipo || 'plano'} codeOnly={true} />
                  </td>
                  <td className="px-1 py-1.5 text-slate-800 dark:text-slate-200">
                    <span className="inline-flex items-start gap-1 text-[11px] font-semibold leading-tight">
                      <CalendarClock className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
                      <span>{periodLabel(p)}</span>
                    </span>
                  </td>
                  <td className="px-1 py-1.5 whitespace-nowrap">
                    <span title={CRITICIDADE_LABELS[p.criticidade]} className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold ${
                      p.criticidade === 'vermelho' ? 'bg-red-100 text-red-800 border border-red-300' :
                      p.criticidade === 'amarelo' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {CRITICIDADE_LABELS[p.criticidade]}
                    </span>
                  </td>
                  <td className="px-1 py-1.5 text-[10px] whitespace-nowrap">
                    {p.executor === 'externo' ? (
                      <span className="inline-flex items-center gap-0.5 font-bold text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200"><Building2 className="h-3 w-3" /> Ext.</span>
                    ) : (
                      <span className="text-slate-600 font-medium">Int.</span>
                    )}
                  </td>
                  <td className="px-1 py-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {renderPmStatusButton(p)}
                  </td>
                  <td className="px-1 py-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {renderNextDate(p)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {shown.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 rounded-b-xl">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <span>Linhas por página:</span>
              <Select sort={false} 
                value={pageSize} 
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                className="bg-transparent border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={-1}>Todos ({plans.length})</option>
              </Select>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-300">
              <span className="text-xs">
                {Math.min((currentPage - 1) * pageSize + 1, shown.length)} - {Math.min(currentPage * pageSize, shown.length)} de {shown.length}
              </span>
              
              <div className="flex items-center gap-1 text-gray-400 dark:text-slate-500">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                  aria-label="Página seguinte"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal criar/editar com ficha completa e campos unificados */}
      {(creating || Boolean(editing)) && (
        <CreateTaskModal
          isOpen={creating || Boolean(editing)}
          onClose={closeModal}
          editingTask={editing}
          titleText={
            editing
              ? `Editar Plano de Manutenção (${getPlanTag(editing) || ''})`
              : 'Novo Plano de Manutenção'
          }
          assets={assets}
          users={users}
          stockRefs={stockRefs}
          isManager={true}
          createAction={createMaintenancePlanAction}
          updateAction={updateMaintenancePlanAction}
          deleteAction={deleteMaintenancePlanAction}
          onDelete={() => router.refresh()}
          allowDuplicate={false}
          planForm={editing ? { nextDate: planInfo(editing).current, active: editing.active !== false, history: planHistory(editing) } : undefined}
          onSuccess={() => {
            closeModal()
            router.refresh()
          }}
        />
      )}

      {/* Modal Perguntar Datas do Calendário */}
      {calendarModalPlan && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCalendarModalPlan(null)} />
          <div className="card relative w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 text-blue-900 mb-1">
                  Agendar Tarefa no Calendário
                </span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-safety-orange" />
                  {calendarModalPlan.title}
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  TAG: <span className="font-bold text-gray-800 dark:text-slate-200">{getPlanTag(calendarModalPlan) || '—'}</span> | Periodicidade: <span className="font-bold text-blue-700 dark:text-blue-400 uppercase">{periodLabel(calendarModalPlan)}</span>
                </p>
              </div>
              <button onClick={() => setCalendarModalPlan(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Datas de Execução ({customCalendarDates.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const last = customCalendarDates[customCalendarDates.length - 1] || calendarStartDate
                      const d = new Date(last)
                      d.setMonth(d.getMonth() + 1)
                      setCustomCalendarDates([...customCalendarDates, d.toISOString().slice(0, 10)])
                    }}
                    className="text-xs text-[#2E86C1] hover:underline font-bold flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar data
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {customCalendarDates.map((dStr, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span>Data Execução #{idx + 1}</span>
                        {customCalendarDates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setCustomCalendarDates((list) => list.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 text-[10px]"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                      <input
                        type="date"
                        value={dStr}
                        onChange={(e) => {
                          const val = e.target.value
                          setCustomCalendarDates((list) => list.map((item, i) => i === idx ? val : item))
                        }}
                        className="input font-mono font-bold text-xs py-1 px-2"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-200 dark:border-slate-800">
              <button type="button" onClick={() => setCalendarModalPlan(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmCalendarSchedule} disabled={savingCalendar} className="btn-primary flex-1">
                {savingCalendar ? 'A guardar…' : 'Confirmar & Agendar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
