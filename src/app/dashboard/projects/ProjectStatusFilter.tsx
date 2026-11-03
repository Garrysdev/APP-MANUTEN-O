'use client'

import { useState } from 'react'
import { FolderKanban, Play, CheckCircle2, ShieldAlert, Building2 } from 'lucide-react'
import { type Task, type TaskStatus, STATUS_LABELS } from '@/types/models'

/**
 * Filtro de estado partilhado por Projetos e Gráficos Gantt, igual ao das OT: abre só com
 * os ativos, os estados somam-se (escolher Pendente e depois Em curso mantém os dois) e
 * os cartões do topo filtram a tabela/gráfico pelo valor que mostram.
 */
export const PROJECT_STATUSES: TaskStatus[] = ['prazo', 'pending', 'in_progress', 'done', 'cancelled']
const ACTIVE: TaskStatus[] = ['prazo', 'pending', 'in_progress']
const HISTORY: TaskStatus[] = ['done', 'cancelled']

type CardFilter = 'overdue' | 'assigned' | null
type CardKey = 'all' | 'in_progress' | 'overdue' | 'done' | 'assigned'

const isOverdue = (t: Task) => t.status !== 'done' && Boolean(t.dueDate) && new Date(t.dueDate as string) < new Date()
const hasTech = (t: Task) => Boolean(t.assignedTo) || Boolean(t.assignedToIds?.length)
const same = (a: TaskStatus[], b: TaskStatus[]) => a.length === b.length && b.every((s) => a.includes(s))

export function useProjectStatusFilter() {
  const [statuses, setStatuses] = useState<TaskStatus[]>(ACTIVE)
  const [card, setCard] = useState<CardFilter>(null)

  const matches = (t: Task) =>
    statuses.includes(t.status) &&
    (card !== 'overdue' || isOverdue(t)) &&
    (card !== 'assigned' || hasTech(t))

  const activeCard: CardKey | null =
    card === 'overdue' ? 'overdue'
      : card === 'assigned' ? 'assigned'
        : same(statuses, PROJECT_STATUSES) ? 'all'
          : same(statuses, ['in_progress']) ? 'in_progress'
            : same(statuses, ['done']) ? 'done'
              : null

  function clickCard(k: CardKey) {
    // Clicar no cartão já escolhido volta aos ativos.
    if (activeCard === k) { setStatuses(ACTIVE); setCard(null); return }
    if (k === 'all') { setStatuses(PROJECT_STATUSES); setCard(null) }
    if (k === 'in_progress') { setStatuses(['in_progress']); setCard(null) }
    if (k === 'done') { setStatuses(['done']); setCard(null) }
    if (k === 'overdue') { setStatuses(PROJECT_STATUSES); setCard('overdue') }
    if (k === 'assigned') { setStatuses(PROJECT_STATUSES); setCard('assigned') }
  }

  function setPreset(list: TaskStatus[]) { setStatuses(list); setCard(null) }

  function toggleStatus(s: TaskStatus) {
    if (statuses.includes(s)) {
      if (statuses.length > 1) setStatuses(statuses.filter((x) => x !== s))
    } else {
      setStatuses([...statuses, s])
    }
  }

  return { statuses, setStatuses: setPreset, toggleStatus, matches, activeCard, clickCard, card }
}

type Ctl = ReturnType<typeof useProjectStatusFilter>

/** Cartões do topo — contam sobre os outros filtros (não sobre o estado), e clicar filtra. */
export function ProjectKpiCards({ base, ctl, inProgressLabel = 'Em Curso' }: { base: Task[]; ctl: Ctl; inProgressLabel?: string }) {
  const cards: { k: CardKey; label: string; value: number; tone: string; num: string; Icon: typeof Play; extra?: string }[] = [
    { k: 'all', label: 'Total Projetos', value: base.length, tone: 'text-slate-500', num: 'text-slate-900 dark:text-slate-100', Icon: FolderKanban },
    { k: 'in_progress', label: inProgressLabel, value: base.filter((t) => t.status === 'in_progress').length, tone: 'text-teal-600', num: 'text-teal-700 dark:text-teal-400', Icon: Play },
    { k: 'overdue', label: 'Em Risco / Atrasados', value: base.filter(isOverdue).length, tone: 'text-red-600', num: 'text-red-700 dark:text-red-400', Icon: ShieldAlert },
    { k: 'done', label: 'Concluídos', value: base.filter((t) => t.status === 'done').length, tone: 'text-green-600', num: 'text-green-700 dark:text-green-400', Icon: CheckCircle2 },
    {
      k: 'assigned', label: 'Técnicos Alocados', tone: 'text-purple-600', num: 'text-purple-700 dark:text-purple-400', Icon: Building2, extra: 'col-span-2 sm:col-span-1',
      value: new Set(base.flatMap((t) => [t.assignedTo, ...(t.assignedToIds || [])]).filter(Boolean)).size,
    },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cards.map(({ k, label, value, tone, num, Icon, extra }) => (
        <button
          key={k}
          type="button"
          onClick={() => ctl.clickCard(k)}
          title="Clique para filtrar"
          className={`text-left bg-white dark:bg-slate-900 p-3.5 rounded-xl border shadow-sm flex items-center justify-between transition-all cursor-pointer hover:border-industrial-blue ${extra || ''} ${
            ctl.activeCard === k ? 'border-industrial-blue ring-2 ring-industrial-blue/30' : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${tone}`}>{label}</span>
            <p className={`text-xl font-extrabold ${num}`}>{value}</p>
          </div>
          <Icon className={`h-7 w-7 opacity-80 ${tone}`} />
        </button>
      ))}
    </div>
  )
}

/** Chips de estado, iguais às OT: Ativos / Histórico / Todos + estados que se somam. */
export function ProjectStatusChips({ ctl }: { ctl: Ctl }) {
  const { statuses, card } = ctl
  const preset = (list: TaskStatus[], label: string, on: string) => (
    <button
      type="button"
      onClick={() => ctl.setStatuses(list)}
      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer ${
        !card && same(statuses, list) ? on : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="flex gap-2 flex-wrap items-center">
      {preset(ACTIVE, '⚡ Ativos', 'bg-industrial-blue text-white ring-2 ring-industrial-blue/30')}
      {preset(HISTORY, '📜 Histórico', 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 ring-2 ring-slate-900/30')}
      {preset(PROJECT_STATUSES, '📋 Todos', 'bg-slate-800 text-white ring-2 ring-slate-800/30')}
      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />
      {PROJECT_STATUSES.map((s) => {
        const isSel = statuses.includes(s)
        return (
          <button
            key={s}
            type="button"
            onClick={() => ctl.toggleStatus(s)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
              isSel ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>{isSel ? '✓' : '+'}</span>
            <span>{STATUS_LABELS[s]}</span>
          </button>
        )
      })}
    </div>
  )
}
