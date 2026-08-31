'use client'

import { useState, useEffect, useTransition, useId, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, FolderKanban, X, Play, CheckCircle2,
  ShieldAlert, Package, CalendarClock, Building2, Eye, GripHorizontal,
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
import { formatDate, formatDateTime } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { TipoBadge } from '@/components/ui/TipoBadge'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import {
  createProjectTaskAction, updateProjectTaskAction, deleteProjectTaskAction, updateProjectTaskStatusAction, updateProjectTaskDatesAction,
  loadStockRefsAction, type StockMaterialRef,
} from './actions'
import CreateTaskModal from '@/components/modals/CreateTaskModal'
import ExcelDateFilter, { ExcelColumnDateFilter, ExcelDateFilterValues, DEFAULT_EXCEL_DATE_FILTER, filterByExcelDate } from '@/components/ui/ExcelDateFilter'

type Ref = { id: string; name: string; tag?: string | null; area?: string | null }
type UserRef = Ref & {
  abbreviation?: string | null
  avatarUrl?: string | null
  active?: boolean
  role?: string | null
  isExternal?: boolean
  externalCompanyId?: string | null
  externalCompanyName?: string | null
}
type TimeScale = 'week' | 'month' | 'year'

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function getDurationInDays(startStr: string, dueStr: string): number {
  const s = new Date(startStr.slice(0, 10) + 'T00:00:00').getTime()
  const e = new Date(dueStr.slice(0, 10) + 'T00:00:00').getTime()
  const days = Math.round((e - s) / 86400000)
  return Math.max(1, days + 1)
}

function cascadeLocalTasks(currentTasks: Task[], changedTaskId: string, changedDueDate: string): Task[] {
  let updated = [...currentTasks]
  const successors = updated.filter((t) => t.dependsOn && Array.isArray(t.dependsOn) && t.dependsOn.includes(changedTaskId))
  for (const succ of successors) {
    const succStart = succ.plannedStartDate ? succ.plannedStartDate.slice(0, 10) : (succ.createdAt ? succ.createdAt.slice(0, 10) : changedDueDate)
    const succDue = succ.dueDate ? succ.dueDate.slice(0, 10) : succStart
    const succDuration = getDurationInDays(succStart, succDue)

    if (changedDueDate >= succStart) {
      const newStart = addDaysToDateStr(changedDueDate, 1)
      const newDue = addDaysToDateStr(newStart, succDuration - 1)
      updated = updated.map((t) => (t.id === succ.id ? { ...t, plannedStartDate: newStart, dueDate: newDue } : t))
      updated = cascadeLocalTasks(updated, succ.id, newDue)
    }
  }
  return updated
}

function GanttChartView({
  tasks,
  users,
  assetName,
  userName,
  assetArea,
  assetTag,
  timeScale,
  setTimeScale,
  dateStartFilter,
  dateEndFilter,
  sortKey,
  sortDir,
  toggleSort,
  onEdit,
  onToggleStatus,
  onRescheduleTask,
  areaFilter,
  setAreaFilter,
  tagFilter,
  setTagFilter,
  techFilter,
  setTechFilter,
  uniqueAreas,
  uniqueTags,
}: {
  tasks: Task[]
  users: UserRef[]
  assetName: (id?: string | null) => string
  userName: (id?: string | null) => string
  assetArea: (id?: string | null) => string
  assetTag: (id?: string | null) => string
  timeScale: TimeScale
  setTimeScale: (ts: TimeScale) => void
  dateStartFilter?: string
  dateEndFilter?: string
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
  toggleSort?: (key: string) => void
  onEdit: (task: Task) => void
  onToggleStatus?: (taskId: string, currentStatus: TaskStatus) => void
  onRescheduleTask?: (taskId: string, newStartDate: string, newDueDate: string) => void
  areaFilter: string
  setAreaFilter: (v: string) => void
  tagFilter: string
  setTagFilter: (v: string) => void
  techFilter: string
  setTechFilter: (v: string) => void
  uniqueAreas: string[]
  uniqueTags: string[]
}) {
  const now = new Date()
  const defaultStart = dateStartFilter ? new Date(dateStartFilter + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const defaultEnd = dateEndFilter ? new Date(dateEndFilter + 'T23:59:59') : new Date(now.getFullYear(), now.getMonth() + 3, 0)

  let minTime = defaultStart.getTime()
  let maxTime = defaultEnd.getTime()

  tasks.forEach((t) => {
    const sDate = t.plannedStartDate ? new Date(t.plannedStartDate.slice(0, 10) + 'T00:00:00').getTime() : (t.createdAt ? new Date(t.createdAt.slice(0, 10) + 'T00:00:00').getTime() : minTime)
    const eDate = t.dueDate ? new Date(t.dueDate.slice(0, 10) + 'T23:59:59').getTime() : sDate + 7 * 86400000
    if (!dateStartFilter && sDate < minTime) minTime = sDate
    if (!dateEndFilter && eDate > maxTime) maxTime = eDate
  })

  const { topHeaders, subHeaders, gridStartMs, gridTotalMs } = useMemo(() => {
    if (timeScale === 'year') {
      const startYear = new Date(minTime).getFullYear()
      const endYear = new Date(maxTime).getFullYear()
      const startObj = new Date(startYear, 0, 1)
      const endObj = new Date(endYear, 11, 31, 23, 59, 59)

      const startMs = startObj.getTime()
      const totalMs = endObj.getTime() - startMs

      const top: { label: string; span: number }[] = []
      const sub: { label: string; dateStr: string; endDateStr: string; isWeekend?: boolean }[] = []

      for (let y = startYear; y <= endYear; y++) {
        top.push({ label: String(y), span: 12 })
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        for (let m = 0; m < 12; m++) {
          const firstDay = new Date(y, m, 1)
          const lastDay = new Date(y, m + 1, 0)
          sub.push({
            label: monthNames[m],
            dateStr: firstDay.toISOString().slice(0, 10),
            endDateStr: lastDay.toISOString().slice(0, 10),
          })
        }
      }

      return { topHeaders: top, subHeaders: sub, gridStartMs: startMs, gridTotalMs: totalMs }
    } else if (timeScale === 'month') {
      const sObj = new Date(minTime)
      const eObj = new Date(maxTime)
      const startMonth = new Date(sObj.getFullYear(), sObj.getMonth(), 1)
      const endMonth = new Date(eObj.getFullYear(), eObj.getMonth() + 1, 0, 23, 59, 59)

      const startMs = startMonth.getTime()
      const totalMs = endMonth.getTime() - startMs

      const top: { label: string; span: number }[] = []
      const sub: { label: string; dateStr: string; endDateStr: string; isWeekend?: boolean }[] = []

      let cur = new Date(startMonth)
      while (cur <= endMonth) {
        const y = cur.getFullYear()
        const m = cur.getMonth()
        const monthLabel = cur.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })
        const daysInCurMonth = new Date(y, m + 1, 0).getDate()

        const weekSpans: { label: string; startDay: number; endDay: number }[] = [
          { label: 'S1', startDay: 1, endDay: 7 },
          { label: 'S2', startDay: 8, endDay: 14 },
          { label: 'S3', startDay: 15, endDay: 21 },
          { label: 'S4', startDay: 22, endDay: 28 },
        ]
        if (daysInCurMonth > 28) {
          weekSpans.push({ label: 'S5', startDay: 29, endDay: daysInCurMonth })
        }

        top.push({ label: monthLabel, span: weekSpans.length })

        weekSpans.forEach((w) => {
          const wStart = new Date(y, m, w.startDay)
          const wEnd = new Date(y, m, w.endDay)
          sub.push({
            label: `${w.label} (${w.startDay}-${w.endDay})`,
            dateStr: wStart.toISOString().slice(0, 10),
            endDateStr: wEnd.toISOString().slice(0, 10),
          })
        })

        cur = new Date(y, m + 1, 1)
      }

      return { topHeaders: top, subHeaders: sub, gridStartMs: startMs, gridTotalMs: totalMs }
    } else {
      const startWeek = new Date(minTime)
      const day = startWeek.getDay()
      startWeek.setDate(startWeek.getDate() - (day === 0 ? 6 : day - 1))
      startWeek.setHours(0, 0, 0, 0)

      const totalDays = Math.ceil((maxTime - startWeek.getTime()) / (1000 * 60 * 60 * 24)) || 30
      const weeksCount = Math.max(4, Math.ceil(totalDays / 7))

      const top: { label: string; span: number }[] = []
      const sub: { label: string; dateStr: string; endDateStr: string; isWeekend?: boolean }[] = []

      for (let w = 0; w < weeksCount; w++) {
        const weekStart = new Date(startWeek)
        weekStart.setDate(weekStart.getDate() + w * 7)
        const monthShort = weekStart.toLocaleDateString('pt-PT', { month: 'short', day: 'numeric' })
        top.push({ label: monthShort, span: 7 })

        for (let d = 0; d < 7; d++) {
          const dayObj = new Date(weekStart)
          dayObj.setDate(dayObj.getDate() + d)
          const dayLetters = ['D', '2ª', '3ª', '4ª', '5ª', '6ª', 'S']
          const dayLetter = dayLetters[dayObj.getDay()]
          const dayNum = dayObj.getDate()
          const isWeekend = dayObj.getDay() === 0 || dayObj.getDay() === 6
          const dStr = dayObj.toISOString().slice(0, 10)
          sub.push({
            label: `${dayLetter} ${dayNum}`,
            dateStr: dStr,
            endDateStr: dStr,
            isWeekend,
          })
        }
      }

      const startMs = startWeek.getTime()
      const totalMs = weeksCount * 7 * 24 * 60 * 60 * 1000

      return { topHeaders: top, subHeaders: sub, gridStartMs: startMs, gridTotalMs: totalMs }
    }
  }, [timeScale, minTime, maxTime])

  const minGridWidth = useMemo(() => {
    if (timeScale === 'week') {
      return Math.max(1200, 380 + subHeaders.length * 42)
    }
    if (timeScale === 'month') {
      return Math.max(1200, 380 + subHeaders.length * 85)
    }
    return Math.max(1200, 380 + subHeaders.length * 60)
  }, [timeScale, subHeaders.length])

  const ROW_HEIGHT = 40

  const dependencyLines = useMemo(() => {
    const lines: {
      id: string
      x1: number
      y1: number
      x2: number
      y2: number
      isWarning: boolean
      predTitle: string
      succTitle: string
    }[] = []

    tasks.forEach((succ, succIdx) => {
      if (!succ.dependsOn || !Array.isArray(succ.dependsOn)) return
      succ.dependsOn.forEach((predId) => {
        const predIdx = tasks.findIndex((t) => t.id === predId)
        if (predIdx === -1) return
        const pred = tasks[predIdx]

        const pStartStr = pred.plannedStartDate ? pred.plannedStartDate.slice(0, 10) : (pred.createdAt ? pred.createdAt.slice(0, 10) : '')
        const pDueStr = pred.dueDate ? pred.dueDate.slice(0, 10) : pStartStr
        const pStart = pStartStr ? new Date(pStartStr + 'T00:00:00') : new Date()
        const pDue = pDueStr ? new Date(pDueStr + 'T23:59:59') : pStart

        const pLeft = Math.max(0, Math.min(100, ((pStart.getTime() - gridStartMs) / gridTotalMs) * 100))
        const pWidth = Math.max(1.5, Math.min(100 - pLeft, ((pDue.getTime() - pStart.getTime()) / gridTotalMs) * 100))

        const sStartStr = succ.plannedStartDate ? succ.plannedStartDate.slice(0, 10) : (succ.createdAt ? succ.createdAt.slice(0, 10) : '')
        const sStart = sStartStr ? new Date(sStartStr + 'T00:00:00') : new Date()
        const sLeft = Math.max(0, Math.min(100, ((sStart.getTime() - gridStartMs) / gridTotalMs) * 100))

        const x1 = Math.min(100, pLeft + pWidth)
        const y1 = predIdx * ROW_HEIGHT + ROW_HEIGHT / 2
        const x2 = sLeft
        const y2 = succIdx * ROW_HEIGHT + ROW_HEIGHT / 2

        const isWarning = Boolean(pDueStr && sStartStr && pDueStr > sStartStr)

        lines.push({
          id: `${pred.id}->${succ.id}`,
          x1,
          y1,
          x2,
          y2,
          isWarning,
          predTitle: pred.title,
          succTitle: succ.title,
        })
      })
    })

    return lines
  }, [tasks, gridStartMs, gridTotalMs])

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Escala de Tempo:</span>
            <div className="inline-flex rounded-xl p-1 bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setTimeScale('week')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  timeScale === 'week'
                    ? 'bg-industrial-blue text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setTimeScale('month')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  timeScale === 'month'
                    ? 'bg-industrial-blue text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Mês
              </button>
              <button
                type="button"
                onClick={() => setTimeScale('year')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  timeScale === 'year'
                    ? 'bg-industrial-blue text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Ano
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>💡 Arraste o centro da barra para mover ou as extremidades para esticar as datas.</span>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <div style={{ minWidth: `${minGridWidth}px` }}>
            <div className="grid grid-cols-[380px_1fr] border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200">
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
                <span className="text-center cursor-pointer hover:text-safety-orange" title="Ordenar por Data de Início" onClick={() => toggleSort?.('plannedStartDate')}>
                  Início{sortKey === 'plannedStartDate' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </span>
                <span className="text-center cursor-pointer hover:text-safety-orange" title="Ordenar por Data de Fim" onClick={() => toggleSort?.('dueDate')}>
                  Fim{sortKey === 'dueDate' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </span>
                <span className="text-center cursor-pointer hover:text-safety-orange" title="Ordenar por Técnico Alocado" onClick={() => toggleSort?.('assignee')}>
                  Técnico{sortKey === 'assignee' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </span>
              </div>
              <div className="flex flex-col">
                <div className="grid grid-flow-col auto-cols-fr border-b border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-center py-1">
                  {topHeaders.map((h, idx) => (
                    <div key={idx} className="border-r border-slate-200 dark:border-slate-700 px-1 truncate">
                      {h.label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-flow-col auto-cols-fr text-[9px] font-mono text-slate-400 py-0.5 text-center">
                  {subHeaders.map((d, dIdx) => (
                    <div
                      key={d.dateStr + dIdx}
                      className={`border-r border-slate-100 dark:border-slate-800 truncate px-0.5 ${
                        d.isWeekend ? 'bg-slate-200/50 dark:bg-slate-800/50 font-bold text-slate-600' : ''
                      }`}
                    >
                      {d.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Sem projetos no filtro selecionado.</div>
              ) : (
                tasks.map((t, idx) => {
                  const sDateStr = t.plannedStartDate ? t.plannedStartDate.slice(0, 10) : (t.createdAt ? t.createdAt.slice(0, 10) : '')
                  const eDateStr = t.dueDate ? t.dueDate.slice(0, 10) : sDateStr
                  const sDate = sDateStr ? new Date(sDateStr + 'T00:00:00') : new Date()
                  const eDate = eDateStr ? new Date(eDateStr + 'T23:59:59') : new Date(sDate.getTime() + 7 * 86400000)

                  const durationDays = getDurationInDays(sDateStr || '2026-08-08', eDateStr || sDateStr || '2026-08-08')

                  const leftPercent = Math.max(0, Math.min(100, ((sDate.getTime() - gridStartMs) / gridTotalMs) * 100))
                  const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, ((eDate.getTime() - sDate.getTime()) / gridTotalMs) * 100))

                  const isCompleted = t.status === 'done'
                  const isOverdue = t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()
                  const isWarning = t.status !== 'done' && t.dueDate && (new Date(t.dueDate).getTime() - new Date().getTime()) < 3 * 86400000

                  let barClass = 'bg-[#0D9488] border-[#0D9488] text-white'
                  if (isCompleted) {
                    barClass = 'bg-[#94A3B8] border-[#94A3B8] text-white'
                  } else if (isOverdue) {
                    barClass = 'bg-[#EF4444] border-[#EF4444] text-white'
                  } else if (isWarning) {
                    barClass = 'bg-[#F59E0B] border-[#F59E0B] text-slate-900'
                  }

                  const assignedUser = users.find((u) => u.id === t.assignedTo)
                  const areaStr = (t as any).area || assetArea(t.assetId) || '—'
                  const tagStr = (t as any).tag || assetTag(t.assetId) || ''
                  const tagDisplay = tagStr || '—'

                  const taskDesc = (t.description || '').trim()
                  const tooltipText = tagStr && taskDesc ? `${tagStr} — ${taskDesc}` : (tagStr ? `${tagStr} — ${t.title}` : (taskDesc || t.title))
                  const barLabel = tagStr ? `${tagStr} — ${t.title}` : t.title

                  return (
                    <div key={t.id} className="grid grid-cols-[380px_1fr] hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors items-center group h-10">
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
                        <span className="truncate font-bold text-slate-800 dark:text-slate-200 text-[10px] cursor-pointer hover:text-safety-orange" onClick={() => onEdit(t)} title={`TAG: ${tagDisplay}`}>
                          {tagDisplay}
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
                      <div className="relative h-10 flex items-center px-1">
                        <div className="absolute inset-0 grid grid-flow-col auto-cols-fr">
                          {subHeaders.map((d, dIdx) => (
                            <div
                              key={d.dateStr + dIdx}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'move'
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                const taskId = e.dataTransfer.getData('taskId')
                                const actionType = e.dataTransfer.getData('actionType') || 'move'
                                const currentDuration = parseInt(e.dataTransfer.getData('durationDays') || '1', 10)
                                const anchorStart = e.dataTransfer.getData('anchorStart')
                                const anchorEnd = e.dataTransfer.getData('anchorEnd')

                                if (taskId && onRescheduleTask) {
                                  if (actionType === 'resize-start') {
                                    const newStartStr = d.dateStr
                                    const newDueStr = anchorEnd && newStartStr > anchorEnd ? newStartStr : (anchorEnd || newStartStr)
                                    onRescheduleTask(taskId, newStartStr, newDueStr)
                                  } else if (actionType === 'resize-end') {
                                    const newDueStr = d.endDateStr || d.dateStr
                                    const newStartStr = anchorStart && newDueStr < anchorStart ? newDueStr : (anchorStart || newDueStr)
                                    onRescheduleTask(taskId, newStartStr, newDueStr)
                                  } else {
                                    const newStartDate = new Date(d.dateStr + 'T09:00:00')
                                    const newEndDate = new Date(newStartDate.getTime() + (currentDuration - 1) * 86400000)
                                    const newStartStr = newStartDate.toISOString().slice(0, 10)
                                    const newDueStr = newEndDate.toISOString().slice(0, 10)
                                    onRescheduleTask(taskId, newStartStr, newDueStr)
                                  }
                                }
                              }}
                              className={`border-r border-slate-100 dark:border-slate-800/60 transition-colors hover:bg-amber-100/40 dark:hover:bg-amber-900/30 ${
                                d.isWeekend ? 'bg-slate-100/40 dark:bg-slate-800/30' : ''
                              }`}
                              title={`Arraste uma barra ou pega para reagendar para ${d.dateStr}`}
                            />
                          ))}
                        </div>
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation()
                            e.dataTransfer.setData('taskId', t.id)
                            e.dataTransfer.setData('actionType', 'move')
                            e.dataTransfer.setData('durationDays', String(durationDays))
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          className={`absolute h-6 rounded shadow-sm border flex items-center justify-between px-1 text-[10px] font-bold z-10 cursor-grab active:cursor-grabbing transition-all hover:scale-y-105 hover:shadow-md select-none group/bar ${barClass}`}
                          onClick={() => onEdit(t)}
                          title={`${tooltipText}\n\nEstado: ${STATUS_LABELS[t.status]}\nTécnico: ${userName(t.assignedTo)}\nInício: ${sDate.toLocaleDateString('pt-PT')} | Fim: ${eDate.toLocaleDateString('pt-PT')}`}
                        >
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation()
                              e.dataTransfer.setData('taskId', t.id)
                              e.dataTransfer.setData('actionType', 'resize-start')
                              e.dataTransfer.setData('anchorEnd', eDateStr)
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            className="absolute -left-1 top-0 bottom-0 w-2.5 cursor-w-resize bg-black/10 hover:bg-black/30 dark:bg-white/10 dark:hover:bg-white/40 rounded-l transition-colors z-20 flex items-center justify-center opacity-0 group-hover/bar:opacity-100"
                            title="Arrastar para alterar início (esticar)"
                          >
                            <span className="w-0.5 h-3 bg-white/70 rounded-full" />
                          </div>
                          <div className="flex items-center justify-between w-full truncate gap-1 px-1 pointer-events-none">
                            <span className="truncate flex items-center gap-1">
                              <GripHorizontal className="h-3 w-3 opacity-60 shrink-0" />
                              {barLabel}
                            </span>
                            {assignedUser && (
                              <span className="bg-black/20 px-1 rounded text-[9px] font-mono shrink-0">
                                {assignedUser.abbreviation || assignedUser.name}
                              </span>
                            )}
                          </div>
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation()
                              e.dataTransfer.setData('taskId', t.id)
                              e.dataTransfer.setData('actionType', 'resize-end')
                              e.dataTransfer.setData('anchorStart', sDateStr)
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-e-resize bg-black/10 hover:bg-black/30 dark:bg-white/10 dark:hover:bg-white/40 rounded-r transition-colors z-20 flex items-center justify-center opacity-0 group-hover/bar:opacity-100"
                            title="Arrastar para alterar fim (esticar)"
                          >
                            <span className="w-0.5 h-3 bg-white/70 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              {dependencyLines.length > 0 && (
                <svg
                  viewBox={`0 0 1000 ${tasks.length * ROW_HEIGHT}`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
                  style={{ left: '380px', width: 'calc(100% - 380px)' }}
                >
                  <defs>
                    <marker
                      id="arrow-norm"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 9 5 L 0 9 z" fill="#6366F1" />
                    </marker>
                    <marker
                      id="arrow-warn"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 9 5 L 0 9 z" fill="#EF4444" />
                    </marker>
                  </defs>
                  {dependencyLines.map((line) => {
                    const sx = line.x1 * 10
                    const sy = line.y1
                    const ex = line.x2 * 10
                    const ey = line.y2
                    const midX = Math.max(sx + 5, (sx + ex) / 2)
                    const pathD = `M ${sx} ${sy} H ${midX} V ${ey} H ${ex}`

                    return (
                      <path
                        key={line.id}
                        d={pathD}
                        fill="none"
                        stroke={line.isWarning ? '#EF4444' : '#6366F1'}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray={line.isWarning ? '4 2' : undefined}
                        markerEnd={line.isWarning ? 'url(#arrow-warn)' : 'url(#arrow-norm)'}
                        className="opacity-75 hover:opacity-100 transition-opacity"
                      >
                        <title>{`Dependência: "${line.predTitle}" ➔ "${line.succTitle}"`}</title>
                      </path>
                    )
                  })}
                </svg>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap text-xs font-semibold">
            <span className="font-bold text-slate-700 dark:text-slate-300">Legenda:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-[#94A3B8] border border-slate-500 inline-block" />
              <span className="text-slate-600 dark:text-slate-400">Concluído</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-[#0D9488] border border-teal-600 inline-block" />
              <span className="text-slate-600 dark:text-slate-400">No prazo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-[#F59E0B] border border-amber-600 inline-block" />
              <span className="text-slate-600 dark:text-slate-400">Em risco</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-[#EF4444] border border-red-600 inline-block" />
              <span className="text-slate-600 dark:text-slate-400">Atrasado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">➔</span>
              <span className="text-slate-600 dark:text-slate-400">Dependência (Finish-to-Start)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-700 dark:text-slate-200 font-extrabold text-sm">♦</span>
              <span className="text-slate-600 dark:text-slate-400">Marco</span>
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
  const [stockRefs, setStockRefs] = useState<StockMaterialRef[]>([])
  const [stockLoaded, setStockLoaded] = useState(false)
  const [stockLoading, setStockLoading] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')
  const [showParagensOnly, setShowParagensOnly] = useState(false)
  const [statusPending, startStatusTransition] = useTransition()

  const isManager = role === 'manager'
  const statuses: TaskStatus[] = ['pending', 'in_progress', 'done']

  function openCreate() {
    setEditing(null)
    setCreating(true)
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
    setCreating(false)
    setEditing(task)
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
  }

  function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    setTaskList((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    )
    startStatusTransition(async () => {
      await updateProjectTaskStatusAction(taskId, newStatus)
    })
  }

  async function handleDelete(task: Task) {
    if (!confirm(`Eliminar "${task.title}"?`)) return
    await deleteProjectTaskAction(task.id)
    router.refresh()
  }

  const [taskList, setTaskList] = useState<Task[]>(tasks)
  useEffect(() => { setTaskList(tasks) }, [tasks])

  const [search, setSearch] = useState('')
  const [searchId, setSearchId] = useState('')
  const [searchArea, setSearchArea] = useState('')
  const [searchTag, setSearchTag] = useState('')
  const [searchTi, setSearchTi] = useState('')
  const [searchProject, setSearchProject] = useState('')
  const [searchTech, setSearchTech] = useState('')

  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedTech, setSelectedTech] = useState<string>('')
  const [viewMode, setViewMode] = useState<'gantt' | 'table'>('gantt')
  const [timeScale, setTimeScale] = useState<TimeScale>('week')
  const [pmTypeFilter, setPmTypeFilter] = useState<'all' | 'pm_only' | 'projects_only'>('all')

  const [dateStartFilter, setDateStartFilter] = useState('')
  const [dateEndFilter, setDateEndFilter] = useState('')
  const [excelDateFilter, setExcelDateFilter] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [excelInicioFilter, setExcelInicioFilter] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [excelFimFilter, setExcelFimFilter] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [areaFilter, setAreaFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, (u as any).abbreviation || u.name])), [users])
  const assetAreaMap = useMemo(() => new Map(assets.map((a) => [a.id, a.area || ''])), [assets])
  const assetTagMap = useMemo(() => new Map(assets.map((a) => [a.id, a.tag || ''])), [assets])

  const assetName = (id?: string | null) => (id ? assetMap.get(id) ?? '—' : '—')
  const userName = (id?: string | null) => (id ? userMap.get(id) ?? id ?? '—' : '—')
  const assetArea = (id?: string | null) => (id ? assetAreaMap.get(id) ?? '—' : '—')
  const assetTag = (id?: string | null) => (id ? assetTagMap.get(id) ?? '—' : '—')

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
          tag: p.tag || null,
          area: p.area || null,
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
            plannedStartDate: '2026-08-08',
            createdAt: '2026-08-08',
            dueDate: '2026-08-08',
            updatedAt: '2026-08-08',
          } as Task)
          list.push({
            ...baseTask,
            id: `plan_${p.id}_2`,
            plannedStartDate: '2026-12-21',
            createdAt: '2026-12-21',
            dueDate: '2026-12-21',
            updatedAt: '2026-12-21',
          } as Task)
        } else if (isAnual) {
          list.push({
            ...baseTask,
            id: `plan_${p.id}_1`,
            plannedStartDate: '2026-08-08',
            createdAt: '2026-08-08',
            dueDate: '2026-08-08',
            updatedAt: '2026-08-08',
          } as Task)
        } else {
          const sDate = p.calendarStartDate || '2026-08-08'
          const eDate = p.nextDueDate || p.calendarStartDate || '2026-08-08'
          list.push({
            ...baseTask,
            id: `plan_${p.id}`,
            plannedStartDate: sDate,
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

  useEffect(() => {
    setCurrentPage(1)
  }, [
    search, searchId, searchArea, searchTag, searchTi, searchProject, searchTech,
    filter, pmTypeFilter, selectedTech, showParagensOnly, dateStartFilter, dateEndFilter,
    areaFilter, tagFilter, pageSize
  ])

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
    const qId = searchId.trim().toLowerCase()
    const qArea = searchArea.trim().toLowerCase()
    const qTag = searchTag.trim().toLowerCase()
    const qTi = searchTi.trim().toLowerCase()
    const qProj = searchProject.trim().toLowerCase()
    const qTech = searchTech.trim().toLowerCase()

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

        if (qId && !t.id.toLowerCase().includes(qId)) return false
        if (qArea) {
          const aArea = (t.assetId ? assetAreaMap.get(t.assetId) || '' : (t as any).area || '').trim().toLowerCase()
          if (!aArea.includes(qArea)) return false
        }
        if (qTag) {
          const aTag = (t.assetId ? assetTagMap.get(t.assetId) || '' : (t as any).tag || '').trim().toLowerCase()
          if (!aTag.includes(qTag)) return false
        }
        if (qTi) {
          const tTipo = (t.tipo || '').toLowerCase()
          const tTipoText = ((t as any).tipoText || '').toLowerCase()
          if (!tTipo.includes(qTi) && !tTipoText.includes(qTi)) return false
        }
        if (qProj) {
          const titleLow = (t.title || '').toLowerCase()
          const descLow = (t.description || '').toLowerCase()
          if (!titleLow.includes(qProj) && !descLow.includes(qProj)) return false
        }
        if (qTech) {
          const uName = (t.assignedTo ? userMap.get(t.assignedTo) || '' : '').toLowerCase()
          if (!uName.includes(qTech)) return false
        }

        if (!filterByExcelDate(t.dueDate || t.createdAt, excelDateFilter)) return false
        if (!filterByExcelDate(t.plannedStartDate || t.createdAt, excelInicioFilter)) return false
        if (!filterByExcelDate(t.dueDate || t.completedAt, excelFimFilter)) return false

        if (dateStartFilter) {
          const startMs = new Date(dateStartFilter + 'T00:00:00').getTime()
          const taskStartMs = t.plannedStartDate ? new Date(t.plannedStartDate).getTime() : (t.createdAt ? new Date(t.createdAt).getTime() : 0)
          if (taskStartMs < startMs) return false
        }
        if (dateEndFilter) {
          const endMs = new Date(dateEndFilter + 'T23:59:59').getTime()
          const taskEndMs = t.dueDate ? new Date(t.dueDate).getTime() : (t.plannedStartDate ? new Date(t.plannedStartDate).getTime() : (t.createdAt ? new Date(t.createdAt).getTime() : 0))
          if (taskEndMs > endMs) return false
        }

        if (q && !text.includes(q)) return false
        return true
      })
      .map(({ task }) => task)
  }, [
    searchIndex, filter, pmTypeFilter, selectedTech, showParagensOnly, areaFilter, tagFilter,
    dateStartFilter, dateEndFilter, search, searchId, searchArea, searchTag, searchTi, searchProject, searchTech,
    assetAreaMap, assetTagMap, userMap, excelDateFilter, excelInicioFilter, excelFimFilter
  ])

  const { sorted: shown, sortKey, sortDir, toggleSort } = useTableSort<Task>(
    filtered,
    {
      title: (t) => t.title?.toLowerCase(),
      tipo: (t) => TIPO_LABELS[t.tipo] ?? t.tipo,
      asset: (t) => assetName(t.assetId),
      assignee: (t) => userName(t.assignedTo),
      status: (t) => STATUS_LABELS[t.status],
      dueDate: (t) => t.dueDate ?? null,
      plannedStartDate: (t) => t.plannedStartDate ?? t.createdAt ?? null,
      area: (t) => (t as any).area || assetArea(t.assetId),
      tag: (t) => (t as any).tag || assetTag(t.assetId),
      duration: (t) => {
        const s = t.plannedStartDate ? t.plannedStartDate.slice(0, 10) : (t.createdAt ? t.createdAt.slice(0, 10) : '')
        const e = t.dueDate ? t.dueDate.slice(0, 10) : s
        return getDurationInDays(s || '2026-08-08', e || s || '2026-08-08')
      },
    },
    null,
  )

  const effectivePageSize = pageSize === -1 ? (shown.length || 1) : pageSize
  const currentShown = useMemo(() => {
    if (pageSize === -1) return shown
    const start = (currentPage - 1) * pageSize
    return shown.slice(start, start + pageSize)
  }, [shown, currentPage, pageSize])

  const totalCount = filtered.length
  const completedCount = filtered.filter((t) => t.status === 'done').length
  const inProgressCount = filtered.filter((t) => t.status === 'in_progress').length
  const overdueCount = filtered.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length
  const allocatedTechsCount = useMemo(() => new Set(filtered.map((t) => t.assignedTo).filter(Boolean)).size, [filtered])

  const modalActive = creating || editing !== null

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-industrial-blue dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span>Controlo de Projetos (Gantt)</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {filtered.length} / {combinedTasks.length}
            </span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-industrial-blue-light dark:text-slate-400 mt-1">
            Gestão visual de cronogramas, OTs do Plano de Manutenção e alocação de técnicos.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowParagensOnly(!showParagensOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border ${
              showParagensOnly
                ? 'bg-amber-500 text-slate-900 border-amber-600 shadow-amber-500/20 ring-2 ring-amber-400'
                : 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700 hover:bg-amber-100'
            }`}
          >
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span>Paragens (AGO/DEZ)</span>
          </button>
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'gantt'
                  ? 'bg-industrial-blue text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="h-3.5 w-3.5" /> Gantt
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-industrial-blue text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <Package className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
          <button onClick={openCreate} className="shrink-0 h-10 px-4 bg-safety-orange hover:bg-safety-orange/90 text-white rounded-xl font-bold text-xs shadow-lg shadow-safety-orange/15 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
            <Plus size={16} className="stroke-[2.5] shrink-0" />
            <span className="hidden sm:inline">Novo Projeto / OT</span>
          </button>
        </div>
      </div>

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

      <div className="flex flex-col gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
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
            <div className="w-36">
              <ExcelColumnDateFilter values={excelDateFilter} onChange={setExcelDateFilter} />
            </div>
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

      {viewMode === 'gantt' ? (
        <GanttChartView
          tasks={shown}
          users={users}
          assetName={assetName}
          userName={userName}
          assetArea={assetArea}
          assetTag={assetTag}
          timeScale={timeScale}
          setTimeScale={setTimeScale}
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
            setTaskList((prev) => {
              const updated = prev.map((t) => (t.id === taskId ? { ...t, plannedStartDate: newStart, dueDate: newDue } : t))
              return cascadeLocalTasks(updated, taskId, newDue)
            })
            startStatusTransition(async () => {
              const res = await updateProjectTaskDatesAction(taskId, newStart, newDue)
              if (res?.error) console.warn(res.error)
            })
          }}
          areaFilter={areaFilter}
          setAreaFilter={setAreaFilter}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          techFilter={selectedTech}
          setTechFilter={setSelectedTech}
          uniqueAreas={uniqueAreas}
          uniqueTags={uniqueTags}
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
                    <SortableTh label="ÁREA" sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="EQUIPAMENTO / TAG" sortableKey="tag" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="TI" sortableKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="PROJETO / DESCRIÇÃO" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="TÉCNICOS" sortableKey="assignee" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="INÍCIO" sortableKey="plannedStartDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
                    <SortableTh label="FIM" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
                    <SortableTh label="CAUSA / OBS" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
                    <SortableTh label="ESTADO" sortableKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-3 py-2 text-right font-mono text-xs font-bold text-slate-700 uppercase tracking-wider">AÇÕES</th>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 p-1">
                    <td className="p-1"><input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="ID..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                    <td className="p-1 relative"><ExcelColumnDateFilter values={excelDateFilter} onChange={setExcelDateFilter} /></td>
                    <td className="p-1"><input value={searchArea} onChange={(e) => setSearchArea(e.target.value)} placeholder="Área..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                    <td className="p-1"><input value={searchTag} onChange={(e) => setSearchTag(e.target.value)} placeholder="TAG..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                    <td className="p-1"><input value={searchTi} onChange={(e) => setSearchTi(e.target.value)} placeholder="TI..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                    <td className="p-1"><input value={searchProject} onChange={(e) => setSearchProject(e.target.value)} placeholder="Projeto..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                    <td className="p-1"><input value={searchTech} onChange={(e) => setSearchTech(e.target.value)} placeholder="Técnico..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                    <td className="p-1 hidden xl:table-cell relative"><ExcelColumnDateFilter values={excelInicioFilter} onChange={setExcelInicioFilter} /></td>
                    <td className="p-1 hidden xl:table-cell relative"><ExcelColumnDateFilter values={excelFimFilter} onChange={setExcelFimFilter} /></td>
                    <td className="p-1 hidden lg:table-cell" />
                    <td className="p-1" />
                    <td className="p-1" />
                  </tr>
                </thead>
                <tbody>
                  {currentShown.map((t, idx) => {
                    const asset = assets.find((a) => a.id === t.assetId)
                    const formattedId = format3DigitId(t.id, idx)
                    const sDateStr = t.plannedStartDate ? t.plannedStartDate.slice(0, 10) : (t.createdAt ? t.createdAt.slice(0, 10) : '')
                    const eDateStr = t.dueDate ? t.dueDate.slice(0, 10) : sDateStr

                    return (
                      <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <span className="bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200">{formattedId}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {formatDate(sDateStr || t.createdAt)}
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
                          {sDateStr ? formatDate(sDateStr) : formatDateTime(t.createdAt)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-700 hidden xl:table-cell whitespace-nowrap">
                          {eDateStr ? formatDate(eDateStr) : (t.updatedAt ? formatDateTime(t.updatedAt) : '—')}
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

      <CreateTaskModal
        isOpen={modalActive}
        onClose={closeModal}
        editingTask={editing}
        assets={assets}
        users={users}
        stockRefs={stockRefs}
        isManager={isManager}
        createAction={createProjectTaskAction}
        updateAction={updateProjectTaskAction}
        availableTasksForDependencies={combinedTasks}
        showDependencies={true}
        onSuccess={(newTask) => {
          router.refresh()
        }}
      />
    </div>
  )
}
