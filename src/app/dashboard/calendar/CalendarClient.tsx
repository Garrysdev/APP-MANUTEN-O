'use client'

import React, { useState, useTransition, useId } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Wrench, ClipboardList, ShieldAlert, X, Plus, Minus, Package } from 'lucide-react'
import type { Task, MaintenancePlan, TaskCriticidade, TipoTarefa, RecurrenceType } from '@/types/models'
import { CRITICIDADE_LABELS, TIPO_LABELS, RECURRENCE_LABELS } from '@/types/models'
import { createTaskFromPlanAction } from './actions'
import { createTaskAction } from '@/app/dashboard/tasks/actions'
import Avatar from '@/components/ui/Avatar'

type Ref = { id: string; name: string }
type UserRef = Ref & { avatarUrl?: string | null }
type ViewMode = 'month' | 'week'

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

function buildEventMap(tasks: Task[], plans: MaintenancePlan[], start: Date, end: Date): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  function add(date: string, ev: CalendarEvent) {
    if (!map.has(date)) map.set(date, [])
    map.get(date)!.push(ev)
  }
  tasks.forEach((task) => {
    if (!task.dueDate) return
    const d = task.dueDate.slice(0, 10)
    const dd = new Date(d + 'T12:00:00')
    if (dd >= start && dd <= end) {
      add(d, { date: d, type: 'task', task, label: task.title, criticidade: task.criticidade })
    }
  })
  plans.filter((p) => p.active).forEach((plan) => {
    computePlanOccurrencesInRange(plan, start, end).forEach((d) =>
      add(d, { date: d, type: 'plan', plan, label: plan.title, criticidade: plan.criticidade })
    )
  })
  return map
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const TIPOS: TipoTarefa[] = ['preventiva', 'curativa', 'plano', 'inspecao', 'lubrificacao', 'calibracao', 'outro']
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
      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
        {icon}{label}
      </label>
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

  // Month view state
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  // Week view state
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today))
  // Shared
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

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
  const [ntDescription, setNtDescription] = useState('')
  const [ntSafetyRules, setNtSafetyRules] = useState<string[]>([''])
  const [ntMaterials, setNtMaterials] = useState<string[]>([''])
  const [ntBusy, startNtTransition] = useTransition()
  const [ntError, setNtError] = useState('')

  // Navigation
  function prevPeriod() {
    setSelectedDate(null)
    if (viewMode === 'month') {
      if (month === 0) { setYear((y) => y - 1); setMonth(11) }
      else setMonth((m) => m - 1)
    } else {
      setWeekStart((ws) => { const d = new Date(ws); d.setDate(d.getDate() - 7); return d })
    }
  }
  function nextPeriod() {
    setSelectedDate(null)
    if (viewMode === 'month') {
      if (month === 11) { setYear((y) => y + 1); setMonth(0) }
      else setMonth((m) => m + 1)
    } else {
      setWeekStart((ws) => { const d = new Date(ws); d.setDate(d.getDate() + 7); return d })
    }
  }

  // Event maps
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59)
  const eventMap = viewMode === 'month'
    ? buildEventMap(tasks, plans, monthStart, monthEnd)
    : buildEventMap(tasks, plans, weekStart, weekEnd)

  const todayStr = toYMD(today)
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
    : (() => {
        const ws = weekStart.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
        const we = new Date(weekStart); we.setDate(we.getDate() + 6)
        const weStr = we.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
        return `${ws} — ${weStr}`
      })()

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

  function openNewTask() {
    setNtTitle(''); setNtTipo('preventiva'); setNtCriticidade('verde')
    setNtAsset(''); setNtAssigned(role === 'technician' ? userId : ''); setNtDescription('')
    setNtSafetyRules(['']); setNtMaterials(['']); setNtError('')
    setNewTaskOpen(true)
  }

  async function handleCreateNewTask() {
    if (!selectedDate || !ntTitle.trim()) { setNtError('O título é obrigatório.'); return }
    if (selectedDate < todayStr) { setNtError('Não é possível agendar tarefas em datas passadas.'); return }
    startNtTransition(async () => {
      const fd = new FormData()
      fd.set('title', ntTitle.trim())
      fd.set('tipo', ntTipo)
      fd.set('criticidade', ntCriticidade)
      fd.set('status', 'pending')
      fd.set('dueDate', selectedDate)
      if (ntDescription.trim()) fd.set('description', ntDescription.trim())
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

  function assetName(id?: string | null) { return assets.find((a) => a.id === id)?.name ?? '—' }
  function userName(id?: string | null) { return users.find((u) => u.id === id)?.name ?? '—' }
  function userRef(id?: string | null) { return users.find((u) => u.id === id) }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <button onClick={prevPeriod} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 justify-center flex-wrap">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">{headerLabel}</h2>
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden text-xs">
            <button
              onClick={() => { setViewMode('month'); setSelectedDate(null) }}
              className={`px-3 py-1.5 font-medium transition-colors ${viewMode === 'month' ? 'bg-[#1B4F72] text-white' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
              Mês
            </button>
            <button
              onClick={() => { setViewMode('week'); setSelectedDate(null) }}
              className={`px-3 py-1.5 font-medium transition-colors ${viewMode === 'week' ? 'bg-[#1B4F72] text-white' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
              Semana
            </button>
          </div>
        </div>
        <button onClick={nextPeriod} className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5 text-[#2E86C1]" /> OT atribuída</span>
        <span className="flex items-center gap-1"><Wrench className="h-3.5 w-3.5 text-amber-500" /> Plano de manutenção</span>
      </div>

      {/* Month grid */}
      {viewMode === 'month' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-800">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-slate-500 py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((day, i) => {
              if (day === null) return <div key={i} className="border-b border-r border-gray-50 dark:border-slate-800/50 min-h-[72px]" />
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const events = eventMap.get(dateStr) ?? []
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const isPast = dateStr < todayStr
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`border-b border-r border-gray-50 dark:border-slate-800/50 min-h-[72px] p-1 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#EAF4FB] dark:bg-blue-900/20' : isPast ? 'bg-gray-50/60 dark:bg-slate-900/40 hover:bg-gray-100/60 dark:hover:bg-slate-800/40' : 'hover:bg-gray-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <p className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-[#2E86C1] text-white' : isPast ? 'text-gray-300 dark:text-slate-600' : 'text-gray-600 dark:text-slate-300'
                  }`}>
                    {day}
                  </p>
                  <div className="space-y-0.5">
                    {events.slice(0, 3).map((ev, j) => (
                      <div key={j} className={`text-[10px] rounded px-1 py-0.5 truncate ${
                        ev.type === 'task' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {ev.label}
                      </div>
                    ))}
                    {events.length > 3 && <p className="text-[10px] text-gray-400 dark:text-slate-500">+{events.length - 3}</p>}
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
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[140px] p-1.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#EAF4FB] dark:bg-blue-900/20' : isPast ? 'bg-gray-50/60 dark:bg-slate-900/40 hover:bg-gray-100/60 dark:hover:bg-slate-800/40' : 'hover:bg-gray-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="space-y-1">
                    {events.map((ev, j) => (
                      <div key={j} className={`text-[10px] rounded px-1 py-0.5 leading-tight ${
                        ev.type === 'task' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {ev.label}
                      </div>
                    ))}
                    {events.length === 0 && (
                      <p className="text-[10px] text-gray-300 dark:text-slate-600 text-center mt-4">—</p>
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
                  onClick={openNewTask}
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
              {selectedEvents.map((ev, i) => (
                <div key={i} className="rounded-lg border border-gray-100 dark:border-slate-800 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {ev.type === 'task'
                        ? <ClipboardList className="h-4 w-4 text-[#2E86C1] dark:text-blue-400 flex-shrink-0" />
                        : <Wrench className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{ev.label}</p>
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
                        onClick={() => {
                          setSelectedPlan(ev.plan!)
                          setDueDate(selectedDate)
                          setAssignTo(ev.plan!.assignedTo ?? '')
                          setCreateError('')
                        }}
                        className="btn-primary text-xs py-1 px-2.5"
                      >
                        Criar tarefa
                      </button>
                    )}
                    {ev.type === 'task' && ev.task && (
                      <a href={`/dashboard/tasks/${ev.task.id}`} className="btn-secondary text-xs py-1 px-2.5">
                        Ver
                      </a>
                    )}
                  </div>
                  {ev.type === 'plan' && ev.plan?.safetyRules && ev.plan.safetyRules.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {ev.plan.safetyRules.length} regra(s) de segurança
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New task modal */}
      {newTaskOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                    {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
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
                    {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Responsável</label>
                  <select value={ntAssigned} onChange={(e) => setNtAssigned(e.target.value)} className="input">
                    <option value="">— Ninguém —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <DynamicList
                label="Regras de segurança"
                icon={<ShieldAlert className="h-4 w-4 text-amber-500" />}
                items={ntSafetyRules}
                onChange={setNtSafetyRules}
                suggestions={PREDEFINED_SAFETY_RULES}
              />
              <DynamicList
                label="Materiais a utilizar"
                icon={<Package className="h-4 w-4 text-gray-500" />}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPlan(null)} />
          <div className="card relative w-full max-w-md p-6 shadow-2xl">
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
    </div>
  )
}
