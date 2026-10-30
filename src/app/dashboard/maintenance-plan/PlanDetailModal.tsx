'use client'

import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Pencil, Trash2, CalendarClock, CheckCircle2, AlertTriangle, History, ExternalLink, Scale, Building2 } from 'lucide-react'
import type { MaintenancePlan, Task } from '@/types/models'
import { CRITICIDADE_LABELS, STATUS_LABELS, statusBadgeClass } from '@/types/models'
import { isPlanTask } from '@/lib/pm-status'

type Row = { key: string; date: string; doneAt: string; task: Task | null; bulk: boolean }

const fmt = (v?: string | null) => {
  if (!v) return '—'
  const [y, m, d] = v.slice(0, 10).split('-')
  return d ? `${d}/${m}/${y}` : v
}

/**
 * Ficha de um Plano de Manutenção (abre ao clicar numa linha do PM), no estilo da ficha do
 * equipamento: dados do plano, OT atual e o histórico completo das execuções — OT de PM
 * ligadas ao plano (de qualquer ano, incluindo o histórico importado) e execuções
 * concluídas em bloco. Daqui edita-se ou elimina-se o plano e abre-se/elimina-se cada OT.
 */
export default function PlanDetailModal({
  plan, tasks, tag, assetName, periodLabel, current, overdue, statusButton, nextDateControl,
  onClose, onEdit, onDelete, onDeleteTask, userName,
}: {
  plan: MaintenancePlan
  tasks: Task[]
  tag: string
  assetName: string
  periodLabel: string
  current: string | null
  overdue: boolean
  statusButton: React.ReactNode
  nextDateControl: React.ReactNode
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onDeleteTask: (t: Task) => void
  userName: (id?: string | null) => string
}) {
  const rows = useMemo<Row[]>(() => {
    const linked = tasks.filter((t) => isPlanTask(plan, t))
    const ids = new Set(linked.map((t) => t.id))
    const fromTasks = linked.map((t) => ({
      key: t.id,
      date: (t.dueDate || t.plannedStartDate || t.completedAt || t.createdAt || '').slice(0, 10),
      doneAt: (t.completedAt || '').slice(0, 10),
      task: t,
      bulk: false,
    }))
    const fromPlan = (plan.executionHistory || [])
      .filter((e) => !e.taskId || !ids.has(e.taskId))
      .map((e, i) => ({ key: `h${i}`, date: e.date, doneAt: e.doneAt, task: null, bulk: Boolean(e.bulk) }))
    return [...fromTasks, ...fromPlan].sort((a, b) => (b.date || b.doneAt).localeCompare(a.date || a.doneAt))
  }, [plan, tasks])

  const doneRows = rows.filter((r) => !r.task || r.task.status === 'done')
  const last = doneRows.map((r) => r.doneAt || r.date).filter(Boolean).sort().pop() || null
  const byYear = useMemo(() => {
    const m = new Map<string, number>()
    doneRows.forEach((r) => { const y = (r.date || r.doneAt).slice(0, 4); if (y) m.set(y, (m.get(y) || 0) + 1) })
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [doneRows])

  const card = 'card p-4 border border-gray-100 dark:border-slate-800'
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-start sm:items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-950 shadow-2xl">
        {/* Cabeçalho */}
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Plano de Manutenção</p>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
              {plan.title}
              {plan.legal && <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-800 font-bold border border-red-300"><Scale className="h-3 w-3" /> Legal</span>}
              <span className={plan.active !== false ? 'badge-done text-[10px]' : 'badge-cancelled text-[10px]'}>{plan.active !== false ? 'Operacional' : 'Inativo'}</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {tag ? `TAG: ${tag}` : 'Sem TAG'} · {plan.area ? `Área: ${plan.area}` : 'Sem área'}
              {plan.assetId ? <> · <Link href={`/dashboard/assets/${encodeURIComponent(plan.assetId)}`} className="text-industrial-blue dark:text-blue-400 hover:underline">{assetName}</Link></> : assetName && assetName !== '—' ? ` · ${assetName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onEdit} className="btn-secondary flex items-center gap-1.5 !py-1.5 !text-xs"><Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Editar plano</span></button>
            <button type="button" onClick={onDelete} className="flex items-center gap-1.5 rounded-xl border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"><Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Eliminar</span></button>
            <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200" aria-label="Fechar"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Cartões */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={card}>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Próxima execução</p>
              <div className={`mt-1 text-lg font-bold ${overdue ? 'text-red-600' : 'text-gray-900 dark:text-slate-100'}`}>{nextDateControl}</div>
              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">{overdue ? <><AlertTriangle className="h-3 w-3 text-red-500" /> Em atraso</> : current ? 'Clica para mudar a data' : 'Sem próxima data'}</p>
            </div>
            <div className={card}>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Estado da OT atual</p>
              <div className="mt-2">{statusButton}</div>
            </div>
            <div className={card}>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Última execução</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-slate-100">{fmt(last)}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{doneRows.length} execuções registadas</p>
            </div>
            <div className={card}>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Periodicidade</p>
              <p className="mt-1 text-sm font-bold text-gray-900 dark:text-slate-100">{periodLabel}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                {CRITICIDADE_LABELS[plan.criticidade] || plan.criticidade}
                {plan.executor === 'externo' && <span className="inline-flex items-center gap-0.5 font-bold text-amber-800"><Building2 className="h-3 w-3" /> Externo</span>}
              </p>
            </div>
          </div>

          {plan.description && (
            <div className={card}>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Descrição / ação</p>
              <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-line">{plan.description}</p>
            </div>
          )}

          {byYear.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {byYear.map(([y, n]) => (
                <span key={y} className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{y}: {n}</span>
              ))}
            </div>
          )}

          {/* Histórico */}
          <div className="card overflow-hidden border border-amber-500/20">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between gap-2">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2"><History className="h-4 w-4 text-amber-600" /> Histórico das OT de PM</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">{rows.length}</span>
            </div>
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500 dark:text-slate-400">Ainda sem execuções registadas deste plano.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                      <th className="px-3 py-2">Data prevista</th>
                      <th className="px-3 py-2">Concluída em</th>
                      <th className="px-3 py-2">OT</th>
                      <th className="px-3 py-2">Técnico</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/20">
                        <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">{fmt(r.date)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">{fmt(r.doneAt)}</td>
                        <td className="px-3 py-2 max-w-[260px]">
                          {r.task ? (
                            <Link href={`/dashboard/tasks/${r.task.id}`} className="font-semibold text-[#2E86C1] hover:underline line-clamp-2" title={r.task.title}>
                              {r.task.otNumber ? `OT ${r.task.otNumber} · ` : ''}{r.task.title}
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-500">{r.bulk ? 'Concluída em bloco (sem OT)' : 'Execução registada'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{r.task ? (userName(r.task.assignedTo) !== '—' ? userName(r.task.assignedTo) : ((r.task as { assignedToText?: string }).assignedToText || r.task.assignedTo || '—')) : '—'}</td>
                        <td className="px-3 py-2">
                          <span className={statusBadgeClass(r.task ? r.task.status : 'done')}>{STATUS_LABELS[r.task ? r.task.status : 'done']}</span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {r.task && (
                            <>
                              <Link href={`/dashboard/tasks/${r.task.id}`} className="inline-flex p-1 text-gray-400 hover:text-[#2E86C1]" title="Abrir / editar a OT"><ExternalLink className="h-4 w-4" /></Link>
                              <button type="button" onClick={() => onDeleteTask(r.task!)} className="inline-flex p-1 text-gray-400 hover:text-red-600" title="Eliminar esta OT"><Trash2 className="h-4 w-4" /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
