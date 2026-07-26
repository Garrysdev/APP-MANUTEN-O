'use client'

import Link from 'next/link'
import type { Task } from '@/types/models'
import { STATUS_LABELS } from '@/types/models'
import { formatDate, taskDelayLevel, DELAY_CLASSES, DELAY_LABELS } from '@/lib/utils'
import { useTableSort, SortableTh } from '@/lib/useTableSort'

type Ref = { id: string; name: string }

/** Tabela "Geral de Tarefas" do dashboard — ordenável por coluna + coluna Técnico (tarefa 16). */
export default function DashboardTasksTable({ tasks, users }: { tasks: Task[]; users: Ref[] }) {
  const technician = (id?: string | null) => users.find((u) => u.id === id)?.name ?? '—'

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort<Task>(
    tasks,
    {
      id: (t) => t.id,
      title: (t) => t.title?.toLowerCase(),
      technician: (t) => technician(t.assignedTo),
      status: (t) => STATUS_LABELS[t.status],
      dueDate: (t) => t.dueDate ?? null,
    },
    null,
  )

  if (tasks.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-gray-400 dark:text-slate-500 text-sm">
        Ainda não existem OTs. Cria a primeira!
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[500px] md:min-w-0">
      <thead>
        <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
          <SortableTh label="ID da OT" sortableKey="id" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left text-gray-500 dark:text-slate-400" />
          <SortableTh label="Ordem de Trabalho (OT)" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left text-gray-500 dark:text-slate-400" />
          <SortableTh label="Técnico" sortableKey="technician" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left hidden sm:table-cell text-gray-500 dark:text-slate-400" />
          <SortableTh label="Estado" sortableKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left text-gray-500 dark:text-slate-400" />
          <SortableTh label="Prazo" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left hidden md:table-cell text-gray-500 dark:text-slate-400" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((task) => {
          const lvl = taskDelayLevel(task.dueDate, task.status)
          return (
            <tr key={task.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
              <td className="px-5 py-3.5 font-bold text-[#1B4F72] dark:text-[#2E86C1] text-xs">
                <Link href={`/dashboard/tasks/${task.id}`} className="hover:underline">
                  WR-{task.id?.slice(-5).toUpperCase()}
                </Link>
              </td>
              <td className="px-3 py-3.5 font-semibold text-gray-800 dark:text-slate-200">{task.title}</td>
              <td className="px-3 py-3.5 text-gray-500 dark:text-slate-400 text-xs hidden sm:table-cell">{technician(task.assignedTo)}</td>
              <td className="px-3 py-3.5">
                <span className={`badge-${task.status}`}>{STATUS_LABELS[task.status]}</span>
              </td>
              <td className="px-3 py-3.5 hidden md:table-cell text-xs">
                {lvl === 'none' ? (
                  <span className="text-gray-400 dark:text-slate-500">{formatDate(task.dueDate ?? null)}</span>
                ) : (
                  <span title={DELAY_LABELS[lvl]} className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${DELAY_CLASSES[lvl]}`}>
                    {formatDate(task.dueDate ?? null)}
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
      </table>
    </div>
  )
}

