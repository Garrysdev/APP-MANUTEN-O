'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Task } from '@/types/models'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function isPMTask(t: Task): boolean {
  const ti = String((t as any).ti || (t as any).tipoText || t.tipo || '').toUpperCase().trim()
  if (ti === 'PM' || ti === 'MP' || ti === 'PREVENTIVA' || ti === 'PLANO') return true
  if (Boolean((t as any).maintenancePlanId) || (t as any).source === 'plano_manutencao' || (t as any).source === 'folha_ur_planos' || String(t.id || '').startsWith('task_pm_')) return true
  const titleLow = String(t.title || '').toLowerCase().trim()
  if (titleLow.startsWith('pm ') || titleLow.startsWith('pm-') || titleLow.startsWith('[pm]') || titleLow.startsWith('mp ') || titleLow.startsWith('[mp]')) return true
  return false
}

function isPITask(t: Task): boolean {
  const ti = String((t as any).ti || (t as any).tipoText || t.tipo || '').toUpperCase().trim()
  if (ti === 'PI') return true
  const titleLow = String(t.title || '').toLowerCase().trim()
  if (titleLow.startsWith('pi ') || titleLow.startsWith('pi-') || titleLow.startsWith('[pi]')) return true
  if ((t as any).source === 'folha_ur_pi' || (t as any).source === 'pedidos_pi') return true
  return false
}

// Mesma ordem de prioridade de campos de data usada em ReportsChartsClient.parseTaskDate,
// para os dois ecrãs concordarem sempre no mesmo ano por tarefa.
function taskYear(t: Task): number | null {
  const dStr = t.plannedStartDate || t.createdAt || t.dueDate || t.completedAt
  if (!dStr) return null
  const s = String(dStr).trim()
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})/)
  if (isoMatch) {
    const yr = parseInt(isoMatch[1], 10)
    if (yr >= 2000 && yr <= 2100) return yr
  }
  const ptMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (ptMatch) {
    const yr = parseInt(ptMatch[3], 10)
    if (yr >= 2000 && yr <= 2100) return yr
  }
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.getFullYear()
  return null
}

export default function DashboardKpiCards({ tasks }: { tasks: Task[] }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear])
    tasks.forEach((t) => {
      const y = taskYear(t)
      if (y) years.add(y)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [tasks, currentYear])

  const tasksInYear = useMemo(() => tasks.filter((t) => taskYear(t) === year), [tasks, year])

  // "Em curso" e "Pendentes" são um retrato do trabalho atual em aberto — não faz
  // sentido filtrar por ano, uma OT pendente criada em 2024 continua pendente hoje.
  const inProgressOTs = useMemo(() => tasks.filter((t) => t.status === 'in_progress').length, [tasks])
  const pendingOTs = useMemo(() => tasks.filter((t) => t.status === 'pending').length, [tasks])

  const totalOTs = tasksInYear.length
  const doneOTs = tasksInYear.filter((t) => t.status === 'done').length

  const pmTasks = useMemo(() => tasksInYear.filter(isPMTask), [tasksInYear])
  const pmTotal = pmTasks.length
  const pmDone = pmTasks.filter((t) => t.status === 'done' || !!t.completedAt).length
  const pmCompliancePct = pmTotal > 0 ? Math.round((pmDone / pmTotal) * 100) : 0

  const piTasks = useMemo(() => tasksInYear.filter(isPITask), [tasksInYear])
  const piRequested = piTasks.length
  const piCompleted = piTasks.filter((t) => t.status === 'done' || !!t.completedAt).length
  const piCompliancePct = piRequested > 0 ? Math.round((piCompleted / piRequested) * 100) : 0

  const yearIdx = availableYears.indexOf(year)
  const goPrevYear = () => { if (yearIdx < availableYears.length - 1) setYear(availableYears[yearIdx + 1]) }
  const goNextYear = () => { if (yearIdx > 0) setYear(availableYears[yearIdx - 1]) }

  return (
    <>
      {/* Seletor de Ano — controla Total OTs, Concluídas, PM e PI abaixo */}
      <div className="flex items-center gap-2 -mb-1">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ano de referência:</span>
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-outline rounded-lg shadow-sm p-0.5">
          <button
            type="button"
            onClick={goPrevYear}
            disabled={yearIdx >= availableYears.length - 1}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Ano anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm font-bold text-industrial-blue dark:text-blue-400 bg-transparent px-1 py-0.5 cursor-pointer focus:outline-none"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}{y === currentYear ? ' (atual)' : ''}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={goNextYear}
            disabled={yearIdx <= 0}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Ano seguinte"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        {year !== currentYear && (
          <button
            type="button"
            onClick={() => setYear(currentYear)}
            className="text-[11px] font-bold text-safety-orange hover:underline cursor-pointer"
          >
            Voltar ao ano atual
          </button>
        )}
      </div>

      {/* ── 1ª LINHA DE INDICADORES ────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/dashboard/tasks" className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-all group">
          <p className="text-4xl font-extrabold text-[#1B4F72] dark:text-blue-400 group-hover:scale-105 transition-transform">{totalOTs}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold flex items-center justify-center gap-1 group-hover:text-industrial-blue">
            <span>Total OTs ({year})</span> <span className="text-[10px]">↗</span>
          </p>
        </Link>
        <Link href="/dashboard/tasks?status=done" className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-all group">
          <p className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">{doneOTs}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold flex items-center justify-center gap-1 group-hover:text-emerald-600">
            <span>Concluídas ({year})</span> <span className="text-[10px]">↗</span>
          </p>
        </Link>
        <Link href="/dashboard/tasks?status=in_progress" className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-all group">
          <p className="text-4xl font-extrabold text-blue-500 dark:text-blue-400 group-hover:scale-105 transition-transform">{inProgressOTs}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold flex items-center justify-center gap-1 group-hover:text-blue-500">
            <span>Em curso</span> <span className="text-[10px]">↗</span>
          </p>
        </Link>
        <Link href="/dashboard/tasks?status=pending" className="bg-white dark:bg-slate-900 border border-outline rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-all group">
          <p className="text-4xl font-extrabold text-amber-600 dark:text-amber-500 group-hover:scale-105 transition-transform">{pendingOTs}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold flex items-center justify-center gap-1 group-hover:text-amber-600">
            <span>Pendentes</span> <span className="text-[10px]">↗</span>
          </p>
        </Link>
      </section>

      {/* ── CUMPRIMENTO PM E PI DO ANO SELECIONADO ────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-slate-900 via-industrial-blue to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400">
              Cumprimento do Plano de Manutenção (PM)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{pmCompliancePct}%</span>
              <span className="text-xs font-bold text-slate-300">
                ({pmDone} de {pmTotal} OTs de PM Existentes)
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              Relação entre OTs de PM concluídas e existentes em {year} ({pmTotal} OTs).
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center font-black text-xl border border-white/20 shrink-0 text-amber-400">
            {pmCompliancePct}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-industrial-blue to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400">
              Pedidos de Intervenção (PI) — Resumo
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{piCompleted} / {piRequested}</span>
              <span className="text-xs font-bold text-slate-300">
                ({piCompliancePct}% PIs Concluídos)
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              Total de solicitações de intervenção criadas e tratadas em {year} ({piRequested} PIs).
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center font-black text-xl border border-white/20 shrink-0 text-amber-400">
            {piCompliancePct}%
          </div>
        </div>
      </section>
    </>
  )
}
