'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import type { Task } from '@/types/models'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { getYearTasksAction, getPMComplianceAction } from './actions'

const EARLIEST_YEAR = 2017

function isPITask(t: Task): boolean {
  const ti = String((t as any).ti || (t as any).tipoText || t.tipo || '').toUpperCase().trim()
  if (ti === 'PI') return true
  const titleLow = String(t.title || '').toLowerCase().trim()
  if (titleLow.startsWith('pi ') || titleLow.startsWith('pi-') || titleLow.startsWith('[pi]')) return true
  if ((t as any).source === 'folha_ur_pi' || (t as any).source === 'pedidos_pi') return true
  return false
}

export default function DashboardKpiCards({
  openTasks,
  initialYear,
  initialYearTasks,
  initialPMCompliance,
}: {
  openTasks: Task[]
  initialYear: number
  initialYearTasks: Task[]
  initialPMCompliance: { total: number; done: number; pct: number }
}) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(initialYear)
  const [yearTasks, setYearTasks] = useState(initialYearTasks)
  const [pmCompliance, setPmCompliance] = useState(initialPMCompliance)
  const [isPending, startTransition] = useTransition()

  const availableYears = useMemo(() => {
    const years: number[] = []
    for (let y = currentYear + 1; y >= EARLIEST_YEAR; y--) years.push(y)
    return years
  }, [currentYear])

  function changeYear(newYear: number) {
    setYear(newYear)
    startTransition(async () => {
      const [tasks, pm] = await Promise.all([
        getYearTasksAction(newYear),
        getPMComplianceAction(newYear),
      ])
      setYearTasks(tasks)
      setPmCompliance(pm)
    })
  }

  // "Em curso" e "Pendentes" são um retrato do trabalho atual em aberto — não faz
  // sentido filtrar por ano, uma OT pendente criada em 2024 continua pendente hoje.
  const inProgressOTs = useMemo(() => openTasks.filter((t) => t.status === 'in_progress').length, [openTasks])
  const pendingOTs = useMemo(() => openTasks.filter((t) => t.status === 'pending').length, [openTasks])

  const totalOTs = yearTasks.length
  const doneOTs = yearTasks.filter((t) => t.status === 'done').length

  const pmTotal = pmCompliance.total
  const pmDone = pmCompliance.done
  const pmCompliancePct = pmCompliance.pct

  const piTasks = useMemo(() => yearTasks.filter(isPITask), [yearTasks])
  const piRequested = piTasks.length
  const piCompleted = piTasks.filter((t) => t.status === 'done' || !!t.completedAt).length
  const piCompliancePct = piRequested > 0 ? Math.round((piCompleted / piRequested) * 100) : 0

  const yearIdx = availableYears.indexOf(year)
  const goPrevYear = () => { if (yearIdx < availableYears.length - 1) changeYear(availableYears[yearIdx + 1]) }
  const goNextYear = () => { if (yearIdx > 0) changeYear(availableYears[yearIdx - 1]) }

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
            onChange={(e) => changeYear(Number(e.target.value))}
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
          {isPending && <Loader2 size={14} className="animate-spin text-slate-400 mx-1" />}
        </div>
        {year !== currentYear && (
          <button
            type="button"
            onClick={() => changeYear(currentYear)}
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
                ({pmDone} de {pmTotal} Planos de Manutenção)
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              Planos de Manutenção com a OT de {year} concluída, do total de planos existentes ({pmTotal}).
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
