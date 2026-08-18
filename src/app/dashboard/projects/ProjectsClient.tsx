'use client'

import { useState, useEffect, useTransition, useId, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, FolderKanban, X, Play, CheckCircle2,
  ShieldAlert, Package, CalendarClock, Building2, Scale, Eye, GripHorizontal,
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
  type MaintenancePlan,
  STATUS_LABELS,
  CRITICIDADE_LABELS,
  TIPO_LABELS,
  PERIODICIDADE_LABELS,
} from '@/types/models'
import { isPlanGanttActive } from '../maintenance-plan/MaintenancePlanClient'
import { formatDate, formatDateTime, taskDelayLevel, DELAY_CLASSES, DELAY_LABELS } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { TipoBadge } from '@/components/ui/TipoBadge'
import MaterialsSelector from '@/components/ui/MaterialsSelector'
import SearchableAssetSelect from '@/components/ui/SearchableAssetSelect'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import {
  createProjectTaskAction, updateProjectTaskAction, deleteProjectTaskAction, updateProjectTaskStatusAction, updateProjectTaskDatesAction,
  loadPlanTaskRefsAction, loadStockRefsAction, type StockMaterialRef,
} from './actions'
import { createMaintenancePlanAction } from '../maintenance-plan/actions'

const PERIODICIDADE_OPTIONS: Periodicidade[] = ['semanal', 'mensal', 'trimestral', 'bianual', 'anual', 'bienal', 'trianual', 'horas', 'pontual']

type Ref = { id: string; name: string }
type UserRef = Ref & { abbreviation?: string | null; avatarUrl?: string | null; active?: boolean }
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

function GanttChartView({
  tasks,
  users,
  assetName,
  userName,
  assetArea,
  assetTag,
  dateStartFilter,
  dateEndFilter,
  sortKey,
  sortDir,
  toggleSort,
  onEdit,
  onToggleStatus,
  onRescheduleTask,
}: {
  tasks: Task[]
  users: UserRef[]
  assetName: (id?: string | null) => string
  userName: (id?: string | null) => string
  assetArea: (id?: string | null) => string
  assetTag: (id?: string | null) => string
  dateStartFilter?: string
  dateEndFilter?: string
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
  toggleSort?: (key: string) => void
  onEdit: (task: Task) => void
  onToggleStatus?: (taskId: string, currentStatus: TaskStatus) => void
  onRescheduleTask?: (taskId: string, newStartDate: string, newDueDate: string) => void
}) {
  const now = new Date()
  const defaultStart = dateStartFilter ? new Date(dateStartFilter + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const defaultEnd = dateEndFilter ? new Date(dateEndFilter + 'T23:59:59') : new Date(now.getFullYear(), now.getMonth() + 3, 0)

  let minTime = defaultStart.getTime()
  let maxTime = defaultEnd.getTime()

  tasks.forEach((t) => {
    const sDate = t.createdAt ? new Date(t.createdAt).getTime() : (t.dueDate ? new Date(t.dueDate).getTime() - 7 * 86400000 : minTime)
    const eDate = t.dueDate ? new Date(t.dueDate).getTime() : sDate + 7 * 86400000
    if (!dateStartFilter && sDate < minTime) minTime = sDate
    if (!dateEndFilter && eDate > maxTime) maxTime = eDate
  })

  const totalDays = Math.ceil((maxTime - minTime) / (1000 * 60 * 60 * 24)) || 30
  const weeksCount = Math.max(4, Math.ceil(totalDays / 7))
  
  const weekHeaders: { label: string; days: { dayLetter: string; dateStr: string; isWeekend: boolean }[] }[] = []
  const startDateObj = new Date(minTime)

  for (let w = 0; w < weeksCount; w++) {
    const weekStart = new Date(startDateObj)
    weekStart.setDate(weekStart.getDate() + w * 7)
    const monthShort = weekStart.toLocaleDateString('pt-PT', { month: 'short', day: 'numeric' })

    const days: { dayLetter: string; dateStr: string; isWeekend: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const dayObj = new Date(weekStart)
      dayObj.setDate(dayObj.getDate() + d)
      const dayLetters = ['D', '2ª', '3ª', '4ª', '5ª', '6ª', 'S']
      const dayLetter = dayLetters[dayObj.getDay()]
      const isWeekend = dayObj.getDay() === 0 || dayObj.getDay() === 6
      days.push({
        dayLetter,
        dateStr: dayObj.toISOString().slice(0, 10),
        isWeekend,
      })
    }

    weekHeaders.push({
      label: monthShort,
      days,
    })
  }

  const gridStartMs = startDateObj.getTime()
  const gridTotalMs = weeksCount * 7 * 24 * 60 * 60 * 1000

  return (
    <div className="space-y-4">
      {/* Visual Gantt Chart Grid */}
      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[1100px]">
            {/* Table Header */}
            <div className="grid grid-cols-[380px_1fr] border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
              {/* Left Side Columns: Área e TAG com Ordenação Clicável */}
              <div className="grid grid-cols-[80px_90px_40px_60px_60px_50px] border-r border-slate-200 dark:border-slate-700 p-2 items-center text-[10px] uppercase tracking-wider font-mono">
                <span className="truncate cursor-pointer hover:text-safety-orange flex items-center gap-0.5" title="Ordenar por Área" onClick={() => toggleSort?.('area')}>
                  Área {sortKey === 'area' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </span>
                <span className="truncate cursor-pointer hover:text-safety-orange flex items-center gap-0.5" title="Ordenar por TAG" onClick={() => toggleSort?.('tag')}>
                  TAG {sortKey === 'tag' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </span>
                <span className="text-center cursor-pointer hover:text-safety-orange" title="Ordenar por Duração" onClick={() => toggleSort?.('duration')}>
                  Dur.{sortKey === 'duration' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </span>
                <span className="text-center cursor-pointer hover:text-safety-orange" title="Ordenar por Data de Início" onClick={() => toggleSort?.('createdAt')}>
                  Start{sortKey === 'createdAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </span>
                <span className="text-center cursor-pointer hover:text-safety-orange" title="Ordenar por Data de Fim" onClick={() => toggleSort?.('dueDate')}>
                  Finish{sortKey === 'dueDate' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </span>
                <span className="text-center cursor-pointer hover:text-safety-orange" title="Ordenar por Técnico Alocado" onClick={() => toggleSort?.('assignee')}>
                  Owner{sortKey === 'assignee' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </span>
              </div>
              {/* Right Side Timeline Header */}
              <div className="flex flex-col">
                {/* Week Row */}
                <div className="grid grid-flow-col auto-cols-fr border-b border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-center py-1">
                  {weekHeaders.map((w, idx) => (
                    <div key={idx} className="border-r border-slate-200 dark:border-slate-700 px-1 truncate">
                      {w.label}
                    </div>
                  ))}
                </div>
                {/* Day Letters Row */}
                <div className="grid grid-flow-col auto-cols-fr text-[9px] font-mono text-slate-400 py-0.5 text-center">
                  {weekHeaders.flatMap((w) =>
                    w.days.map((d, dIdx) => (
                      <div
                        key={d.dateStr + dIdx}
                        className={`border-r border-slate-100 dark:border-slate-800 ${
                          d.isWeekend ? 'bg-slate-200/50 dark:bg-slate-800/50 font-bold text-slate-600' : ''
                        }`}
                      >
                        {d.dayLetter}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Task Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {tasks.map((t, idx) => {
                const sDate = t.createdAt ? new Date(t.createdAt) : (t.dueDate ? new Date(new Date(t.dueDate).getTime() - 7 * 86400000) : new Date())
                const eDate = t.dueDate ? new Date(t.dueDate) : new Date(sDate.getTime() + 7 * 86400000)

                const durationDays = Math.max(1, Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)))

                const leftPercent = Math.max(0, Math.min(100, ((sDate.getTime() - gridStartMs) / gridTotalMs) * 100))
                const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, ((eDate.getTime() - sDate.getTime()) / gridTotalMs) * 100))

                const isCompleted = t.status === 'done'
                const isOverdue = t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()
                const isWarning = t.status !== 'done' && t.dueDate && (new Date(t.dueDate).getTime() - new Date().getTime()) < 3 * 86400000

                let barClass = 'bg-[#0D9488] border-[#0D9488] text-white' // On track (Teal)
                if (isCompleted) {
                  barClass = 'bg-[#94A3B8] border-[#94A3B8] text-white' // Complete (Grey)
                } else if (isOverdue) {
                  barClass = 'bg-[#EF4444] border-[#EF4444] text-white' // Needs immediate attention (Red)
                } else if (isWarning) {
                  barClass = 'bg-[#F59E0B] border-[#F59E0B] text-slate-900' // In trouble (Amber)
                }

                const assignedUser = users.find((u) => u.id === t.assignedTo)
                const areaStr = (t as any).area || assetArea(t.assetId) || '—'
                const tagStr = (t as any).tag || assetTag(t.assetId) || '—'

                return (
                  <div key={t.id} className="grid grid-cols-[380px_1fr] hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors items-center group">
                    {/* Left Column side: Área e TAG */}
                    <div className="grid grid-cols-[80px_90px_40px_60px_60px_50px] border-r border-slate-200 dark:border-slate-800 p-2 items-center font-mono">
                      <div className="flex items-center gap-1 overflow-hidden" title={`Área: ${areaStr}`}>
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={(e) => {
                            e.stopPropagation()
                            if (onToggleStatus) onToggleStatus(t.id, t.status)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 shrink-0 cursor-pointer"
                          title={isCompleted ? "Marcar como pendente" : "Encerrar OT no Gantt"}
                        />
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-[10px] cursor-pointer hover:text-safety-orange" onClick={() => onEdit(t)}>
                          {areaStr}
                        </span>
                      </div>
                      <span className="truncate font-bold text-slate-800 dark:text-slate-200 text-[10px] cursor-pointer hover:text-safety-orange" onClick={() => onEdit(t)} title={`TAG: ${tagStr}`}>
                        {tagStr}
                      </span>
                      <span className="text-center font-bold text-slate-600 text-[10px]">{durationDays}d</span>
                      <span className="text-center text-[10px] text-slate-500">{sDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}</span>
                      <span className="text-center text-[10px] text-slate-500">{eDate.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}</span>
                      <div className="flex justify-center" title={userName(t.assignedTo)}>
                        {assignedUser ? (
                          <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 truncate max-w-[45px]">
                            {assignedUser.abbreviation || assignedUser.name.slice(0, 5)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </div>
                    </div>

                    {/* Right Timeline Grid side with Gantt Bar */}
                    <div className="relative h-10 flex items-center px-1">
                      {/* Grid vertical lines background acting as drop targets */}
                      <div className="absolute inset-0 grid grid-flow-col auto-cols-fr">
                        {weekHeaders.flatMap((w) =>
                          w.days.map((d, dIdx) => (
                            <div
                              key={d.dateStr + dIdx}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'move'
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                const taskId = e.dataTransfer.getData('taskId')
                                const durationDays = parseInt(e.dataTransfer.getData('durationDays') || '1', 10)
                                if (taskId && onRescheduleTask) {
                                  const newStartDate = new Date(d.dateStr + 'T09:00:00')
                                  const newEndDate = new Date(newStartDate.getTime() + (durationDays - 1) * 86400000)
                                  const newStartStr = newStartDate.toISOString().slice(0, 10)
                                  const newDueStr = newEndDate.toISOString().slice(0, 10)
                                  onRescheduleTask(taskId, newStartStr, newDueStr)
                                }
                              }}
                              className={`border-r border-slate-100 dark:border-slate-800/60 transition-colors hover:bg-amber-100/40 dark:hover:bg-amber-900/30 ${
                                d.isWeekend ? 'bg-slate-100/40 dark:bg-slate-800/30' : ''
                              }`}
                              title={`Arraste uma barra para aqui para reagendar para ${d.dateStr}`}
                            />
                          ))
                        )}
                      </div>

                      {/* Horizontal Gantt Bar - Arrastável */}
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          e.dataTransfer.setData('taskId', t.id)
                          e.dataTransfer.setData('durationDays', String(durationDays))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                        className={`absolute h-6 rounded shadow-sm border flex items-center px-2 text-[10px] font-bold z-10 cursor-grab active:cursor-grabbing transition-all hover:scale-y-105 hover:shadow-md ${barClass}`}
                        onClick={() => onEdit(t)}
                        title={`🖐️ Arraste esta barra para a coluna do dia pretendido para REAGENDAR!\n\n${t.title}\nEstado: ${STATUS_LABELS[t.status]}\nTécnico: ${userName(t.assignedTo)}\nInício: ${sDate.toLocaleDateString('pt-PT')} | Fim: ${eDate.toLocaleDateString('pt-PT')}`}
                      >
                        <div className="flex items-center justify-between w-full truncate gap-1 pointer-events-none">
                          <span className="truncate flex items-center gap-1">
                            <GripHorizontal className="h-3 w-3 opacity-60 shrink-0" />
                            {t.title}
                          </span>
                          {assignedUser && (
                            <span className="bg-black/20 px-1 rounded text-[9px] font-mono shrink-0">
                              {assignedUser.abbreviation || assignedUser.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Gantt Chart Legend Box (Estilo Lucidspark) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap text-xs font-semibold">
            <span className="font-bold text-slate-700 dark:text-slate-300">Legenda:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-[#94A3B8] border border-slate-500 inline-block" />
              <span className="text-slate-600 dark:text-slate-400">Complete (Concluído)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-[#0D9488] border border-teal-600 inline-block" />
              <span className="text-slate-600 dark:text-slate-400">On track (No prazo)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-[#F59E0B] border border-amber-600 inline-block" />
              <span className="text-slate-600 dark:text-slate-400">In trouble (Em risco)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-[#EF4444] border border-red-600 inline-block" />
              <span className="text-slate-600 dark:text-slate-400">Needs immediate attention (Atrasado)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-700 dark:text-slate-200 font-extrabold text-sm">♦</span>
              <span className="text-slate-600 dark:text-slate-400">Milestone (Marco)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsClient({
  tasks,
  assets,
  users,
  plans = [],
  role,
  userId,
}: {
  tasks: Task[]
  assets: Ref[]
  users: UserRef[]
  plans?: MaintenancePlan[]
  role: UserRole
  userId: string
}) {
  const router = useRouter()
  const { dict } = useLanguage()
  const [plansList, setPlansList] = useState<PlanRef[]>([])
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
  const [showParagensOnly, setShowParagensOnly] = useState(false)
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
        setPlansList(res as PlanRef[])
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
        setPlansList(res as PlanRef[])
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
    setTaskList((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    )
    startStatusTransition(async () => {
      await updateProjectTaskStatusAction(taskId, newStatus)
    })
  }

  const [taskList, setTaskList] = useState<Task[]>(tasks)
  useEffect(() => { setTaskList(tasks) }, [tasks])

  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedTech, setSelectedTech] = useState<string>('')
  const [viewMode, setViewMode] = useState<'gantt' | 'table'>('gantt')
  const [pmTypeFilter, setPmTypeFilter] = useState<'all' | 'pm_only' | 'projects_only'>('all')

  const [dateStartFilter, setDateStartFilter] = useState('')
  const [dateEndFilter, setDateEndFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, (u as any).abbreviation || u.name])), [users])
  const assetAreaMap = useMemo(() => new Map(assets.map((a) => [a.id, (a as any).area || ''])), [assets])
  const assetTagMap = useMemo(() => new Map(assets.map((a) => [a.id, (a as any).tag || ''])), [assets])

  const assetName = (id?: string | null) => (id ? assetMap.get(id) ?? '—' : '—')
  const userName = (id?: string | null) => (id ? userMap.get(id) ?? id ?? '—' : '—')
  const assetArea = (id?: string | null) => (id ? assetAreaMap.get(id) ?? '—' : '—')
  const assetTag = (id?: string | null) => (id ? assetTagMap.get(id) ?? '—' : '—')

  // Converter itens do Plano de Manutenção marcados para o Gantt em tarefas visuais
  const planGanttTasks = useMemo(() => {
    const list: Task[] = []
    ;(plans || [])
      .filter((p) => isPlanGanttActive(p))
      .forEach((p) => {
        const title = `[PM] ${p.title} (${(p.periodicidadeLabel || p.periodicidade || 'PM').toUpperCase()})`
        const pLow = String(p.periodicidade || '').toLowerCase()
        const pLabelLow = String(p.periodicidadeLabel || '').toLowerCase()
        const titleLow = String(p.title || '').toLowerCase()
        const descLow = String(p.description || '').toLowerCase()
        const combo = `${pLow} ${pLabelLow} ${titleLow} ${descLow}`

        const isBianual = combo.includes('bianual') || combo.includes('2x/ano') || combo.includes('2x ano')
        const isAnual = combo.includes('anual') || combo.includes('1x/ano')

        const baseTask: Partial<Task> = {
          companyId: p.companyId,
          title,
          description: `Plano de Manutenção: ${p.periodicidadeLabel || p.periodicidade || 'PM'} | TAG: ${p.tag || '—'}`,
          assetId: p.assetId,
          assignedTo: p.assignedTo,
          criticidade: p.criticidade,
          tipo: 'plano' as TipoTarefa,
          status: 'pending' as TaskStatus,
          createdBy: p.createdBy,
        }

        if (isBianual) {
          list.push({
            ...baseTask,
            id: `plan_${p.id}_1`,
            createdAt: '2026-08-08',
            dueDate: '2026-08-08',
            updatedAt: '2026-08-08',
          } as Task)
          list.push({
            ...baseTask,
            id: `plan_${p.id}_2`,
            createdAt: '2026-12-21',
            dueDate: '2026-12-21',
            updatedAt: '2026-12-21',
          } as Task)
        } else if (isAnual) {
          list.push({
            ...baseTask,
            id: `plan_${p.id}_1`,
            createdAt: '2026-08-08',
            dueDate: '2026-08-08',
            updatedAt: '2026-08-08',
          } as Task)
        } else {
          let sDate = p.calendarStartDate || '2026-08-08'
          let eDate = p.calendarStartDate || '2026-08-08'
          list.push({
            ...baseTask,
            id: `plan_${p.id}`,
            createdAt: sDate,
            dueDate: eDate,
            updatedAt: sDate,
          } as Task)
        }
      })
    return list
  }, [plans])

  const combinedTasks = useMemo(() => {
    return [...taskList, ...planGanttTasks]
  }, [taskList, planGanttTasks])

  const uniqueAreas = useMemo(() => {
    const set = new Set<string>()
    assets.forEach((a: any) => { if (a.area) set.add(a.area.trim()) })
    combinedTasks.forEach((t: any) => {
      const aArea = t.assetId ? assetAreaMap.get(t.assetId) || '' : ''
      const area = t.area || aArea
      if (area && area.trim() && area !== '—') set.add(area.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [assets, combinedTasks, assetAreaMap])

  const uniqueTags = useMemo(() => {
    const set = new Set<string>()
    assets.forEach((a: any) => {
      if (!areaFilter || (a.area || '').trim().toLowerCase() === areaFilter.trim().toLowerCase()) {
        if (a.tag) set.add(a.tag.trim())
      }
    })
    combinedTasks.forEach((t: any) => {
      const aArea = t.assetId ? assetAreaMap.get(t.assetId) || '' : ''
      const tArea = t.area || aArea
      if (!areaFilter || tArea.trim().toLowerCase() === areaFilter.trim().toLowerCase()) {
        const aTag = t.assetId ? assetTagMap.get(t.assetId) || '' : ''
        const tag = t.tag || aTag
        if (tag && tag.trim() && tag !== '—') set.add(tag.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [assets, combinedTasks, areaFilter, assetAreaMap, assetTagMap])

  useEffect(() => { setCurrentPage(1) }, [search, filter, pmTypeFilter, selectedTech, showParagensOnly, dateStartFilter, dateEndFilter, areaFilter, tagFilter, pageSize])

  const searchIndex = useMemo(() => {
    const assetSearchMap = new Map(assets.map((a) => [a.id, `${a.name || ''} ${(a as any).tag || ''} ${(a as any).area || ''}`.toLowerCase()]))
    const userSearchMap = new Map(users.map((u) => [u.id, `${u.name || ''} ${(u as any).abbreviation || ''}`.toLowerCase()]))

    return combinedTasks.map((t) => {
      const aSearch = t.assetId ? assetSearchMap.get(t.assetId) || '' : ''
      const uSearch = t.assignedTo ? userSearchMap.get(t.assignedTo) || '' : ''
      const text = `${t.title || ''} ${t.description || ''} ${(t as any).tag || ''} ${(t as any).area || ''} ${aSearch} ${uSearch}`.toLowerCase()
      return { task: t, text }
    })
  }, [combinedTasks, assets, users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return searchIndex
      .filter(({ task: t, text }) => {
        const isPmTask =
          t.tipo === 'plano' ||
          t.id.startsWith('plan_') ||
          (t.title || '').startsWith('[PM]') ||
          (t.description || '').toLowerCase().includes('plano de manutenção')

        if (pmTypeFilter === 'pm_only' && !isPmTask) return false
        if (pmTypeFilter === 'projects_only' && isPmTask) return false

        if (filter !== 'all' && t.status !== filter) return false
        if (selectedTech && t.assignedTo !== selectedTech) return false
        if (showParagensOnly) {
          const titleUpper = (t.title || '').toUpperCase()
          const descUpper = (t.description || '').toUpperCase()
          const isParagem =
            titleUpper.includes('AGO') ||
            titleUpper.includes('DEZ') ||
            titleUpper.includes('PARAGEM') ||
            titleUpper.includes('PARAGENS') ||
            titleUpper.includes('BIANUAL') ||
            descUpper.includes('AGO') ||
            descUpper.includes('DEZ') ||
            descUpper.includes('PARAGEM')
          if (!isParagem) return false
        }

        if (areaFilter) {
          const af = areaFilter.trim().toLowerCase()
          const aArea = (t.assetId ? assetAreaMap.get(t.assetId) || '' : (t as any).area || '').trim().toLowerCase()
          if (aArea !== af && !aArea.split(/[\s,/]+/).includes(af)) return false
        }

        if (tagFilter) {
          const tf = tagFilter.trim().toLowerCase()
          const aTag = (t.assetId ? assetTagMap.get(t.assetId) || '' : (t as any).tag || '').trim().toLowerCase()
          if (aTag !== tf && !aTag.split(/[\s,/]+/).includes(tf)) return false
        }

        if (dateStartFilter) {
          const startMs = new Date(dateStartFilter + 'T00:00:00').getTime()
          const taskStartMs = t.createdAt ? new Date(t.createdAt).getTime() : (t.dueDate ? new Date(t.dueDate).getTime() - 7 * 86400000 : 0)
          if (taskStartMs < startMs) return false
        }
        if (dateEndFilter) {
          const endMs = new Date(dateEndFilter + 'T23:59:59').getTime()
          const taskEndMs = t.dueDate ? new Date(t.dueDate).getTime() : (t.createdAt ? new Date(t.createdAt).getTime() + 7 * 86400000 : 0)
          if (taskEndMs > endMs) return false
        }

        if (q && !text.includes(q)) return false
        return true
      })
      .map(({ task }) => task)
  }, [searchIndex, filter, pmTypeFilter, selectedTech, showParagensOnly, areaFilter, tagFilter, dateStartFilter, dateEndFilter, search, assetAreaMap, assetTagMap])

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

  // Totalizadores dinâmicos calculados com base nas tarefas filtradas no ecrã
  const totalCount = filtered.length
  const completedCount = filtered.filter((t) => t.status === 'done').length
  const inProgressCount = filtered.filter((t) => t.status === 'in_progress').length
  const overdueCount = filtered.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length
  const allocatedTechsCount = useMemo(() => new Set(filtered.map((t) => t.assignedTo).filter(Boolean)).size, [filtered])

  const modalActive = creating || editing !== null

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-outline/60 gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-extrabold text-industrial-blue tracking-tight truncate flex items-center gap-2">
            <FolderKanban size={26} className="text-safety-orange" />
            Controlo de Projetos (Gantt - Módulo Pro)
          </h1>
          <p className="text-xs sm:text-sm font-medium text-industrial-blue-light mt-1">
            Gestão visual de cronogramas, OTs do Plano de Manutenção e alocação de técnicos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão de Filtro Rápido: Paragens Manutenção AGO / DEZ */}
          <button
            onClick={() => setShowParagensOnly(!showParagensOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border ${
              showParagensOnly
                ? 'bg-amber-500 text-slate-900 border-amber-600 shadow-amber-500/20 ring-2 ring-amber-400'
                : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700 hover:bg-amber-100'
            }`}
          >
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span>Paragens Manutenção (AGO/DEZ)</span>
          </button>

          {/* View Mode Toggle Buttons */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'gantt'
                  ? 'bg-industrial-blue text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="h-3.5 w-3.5" /> Gantt (Cronograma)
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-industrial-blue text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Package className="h-3.5 w-3.5" /> Lista de Projetos
            </button>
          </div>

          <button onClick={openCreate} className="shrink-0 h-10 px-4 bg-safety-orange hover:bg-safety-orange/90 text-white rounded-xl font-bold text-xs shadow-lg shadow-safety-orange/15 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
            <Plus size={16} className="stroke-[2.5] shrink-0" />
            <span className="hidden sm:inline">Novo Projeto / OT</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Totalizadores Dinâmicos) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Projetos</span>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{totalCount}</p>
          </div>
          <FolderKanban className="h-7 w-7 text-blue-600 opacity-80" />
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Em Progresso</span>
            <p className="text-xl font-extrabold text-teal-700 dark:text-teal-400">{inProgressCount}</p>
          </div>
          <Play className="h-7 w-7 text-teal-600 opacity-80" />
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Em Risco / Atrasados</span>
            <p className="text-xl font-extrabold text-red-700 dark:text-red-400">{overdueCount}</p>
          </div>
          <ShieldAlert className="h-7 w-7 text-red-600 opacity-80" />
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Concluídos</span>
            <p className="text-xl font-extrabold text-green-700 dark:text-green-400">{completedCount}</p>
          </div>
          <CheckCircle2 className="h-7 w-7 text-green-600 opacity-80" />
        </div>
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Técnicos Alocados</span>
            <p className="text-xl font-extrabold text-purple-700 dark:text-purple-400">{allocatedTechsCount}</p>
          </div>
          <Building2 className="h-7 w-7 text-purple-600 opacity-80" />
        </div>
      </div>

      {/* Filter Toolbar com Filtros de Origem, Estado e Datas */}
      <div className="flex flex-col gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Seletor de Origem de Tarefa (PM vs Projetos) */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setPmTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pmTypeFilter === 'all'
                  ? 'bg-industrial-blue text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              📊 Ver Todos
            </button>
            <button
              type="button"
              onClick={() => setPmTypeFilter('pm_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pmTypeFilter === 'pm_only'
                  ? 'bg-safety-orange text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              📋 Ver só PM (Plano de Manutenção)
            </button>
            <button
              type="button"
              onClick={() => setPmTypeFilter('projects_only')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pmTypeFilter === 'projects_only'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              🏗️ Ver só outros projetos
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap items-center">
            {(['all', ...statuses] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                  filter === s ? 'bg-industrial-blue text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {s === 'all' ? 'Todos os Estados' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro entre datas */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <CalendarClock className="h-3.5 w-3.5 text-safety-orange shrink-0" />
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">Datas:</span>
            <input
              type="date"
              value={dateStartFilter}
              onChange={(e) => setDateStartFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none w-28"
              title="Data de Início"
            />
            <span className="text-xs font-bold text-slate-400">a</span>
            <input
              type="date"
              value={dateEndFilter}
              onChange={(e) => setDateEndFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none w-28"
              title="Data de Fim"
            />
            {(dateStartFilter || dateEndFilter) && (
              <button
                type="button"
                onClick={() => { setDateStartFilter(''); setDateEndFilter('') }}
                className="text-slate-400 hover:text-red-500 font-bold ml-1 text-xs"
                title="Limpar filtro de datas"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

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

          {/* Técnico Alocado Dropdown */}
          <select
            value={selectedTech}
            onChange={(e) => setSelectedTech(e.target.value)}
            className="input text-xs py-1.5 px-3 w-44 font-bold"
          >
            <option value="">-- Todos os Técnicos --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                👤 {u.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar Projeto, TAG..."
            className="input text-xs py-1.5 px-3 w-40 sm:w-48"
          />
        </div>
      </div>
    </div>

      {/* Render Gantt View or Table View */}
      {viewMode === 'gantt' ? (
        <GanttChartView
          tasks={shown}
          users={users}
          assetName={assetName}
          userName={userName}
          assetArea={assetArea}
          assetTag={assetTag}
          dateStartFilter={dateStartFilter}
          dateEndFilter={dateEndFilter}
          sortKey={sortKey}
          sortDir={sortDir}
          toggleSort={toggleSort}
          onEdit={openEdit}
          onToggleStatus={(taskId, currentStatus) => {
            const nextStatus = currentStatus === 'done' ? 'pending' : 'done'
            handleStatusChange(taskId, nextStatus)
          }}
          onRescheduleTask={(taskId, newStart, newDue) => {
            setTaskList((prev) =>
              prev.map((t) => (t.id === taskId ? { ...t, createdAt: newStart, dueDate: newDue } : t))
            )
            startStatusTransition(async () => {
              const res = await updateProjectTaskDatesAction(taskId, newStart, newDue)
              if (res?.error) console.warn(res.error)
            })
          }}
        />
      ) : (
        <div className="card overflow-hidden">
        {shown.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400">
            <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Sem projetos neste filtro.</p>
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
                {/* Linha de Filtro por Coluna */}
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 p-1">
                  <td className="p-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                  <td className="p-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Data..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                  <td className="p-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Área..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                  <td className="p-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="TAG..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                  <td className="p-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="TI..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                  <td className="p-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Projeto..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                  <td className="p-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Técnico..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                  <td className="p-1 hidden xl:table-cell" />
                  <td className="p-1 hidden xl:table-cell" />
                  <td className="p-1 hidden lg:table-cell" />
                  <td className="p-1" />
                  <td className="p-1" />
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
                        <TipoBadge tipo={t.tipo} codeOnly={true} />
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
      )}

      {/* Modal Criar / Editar Projeto */}
      {modalActive && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-4 sm:pt-8 overflow-y-auto">
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative my-auto sm:my-4">
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
                  <SearchableAssetSelect
                    value={selectedAssetId}
                    onChange={(val) => setSelectedAssetId(val)}
                    assets={assets}
                    placeholder="-- Sem equipamento --"
                  />
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
                    {users
                      .filter((u) => u.active !== false)
                      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.abbreviation ? `[${u.abbreviation}] ${u.name}` : u.name}
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

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {editing && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextStatus = editing.status === 'done' ? 'pending' : 'done'
                      handleStatusChange(editing.id, nextStatus)
                      closeModal()
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                      editing.status === 'done'
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md'
                    }`}
                  >
                    <CheckCircle2 size={15} />
                    <span>{editing.status === 'done' ? 'Reabrir OT (Pendente)' : 'Encerrar OT (Concluída)'}</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button type="button" onClick={closeModal} className="btn-secondary text-xs">
                    {dict.common.cancel}
                  </button>
                  <button type="submit" disabled={busy} className="btn-primary text-xs font-bold">
                    {busy ? 'A guardar...' : dict.common.save}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
