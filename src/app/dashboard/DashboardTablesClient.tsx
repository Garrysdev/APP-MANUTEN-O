'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { FolderKanban, ClipboardList, AlertTriangle, Filter, ArrowRight } from 'lucide-react'
import { TipoBadge } from '@/components/ui/TipoBadge'
import type { Task, User } from '@/types/models'
import { formatDate } from '@/lib/utils'
import { useTableSort, SortableTh } from '@/lib/useTableSort'

const getStatusStyles = (status: string, criticidade?: string) => {
  if (status === 'in_progress' && criticidade === 'vermelho') return 'bg-red-50 text-red-700 border-red-200'
  switch (status) {
    case 'in_progress': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'done': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    default: return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

const getStatusLabel = (status: string, criticidade?: string) => {
  if (status === 'in_progress' && criticidade === 'vermelho') return 'Emergência'
  if (status === 'in_progress') return 'Em Curso'
  if (status === 'pending') return 'Atribuída'
  if (status === 'done') return 'Concluída'
  return status
}

function TableSection({
  title,
  icon: Icon,
  tasks,
  usersList,
  viewAllHref,
  emptyMessage,
}: {
  title: string
  icon: any
  tasks: Task[]
  usersList: User[]
  viewAllHref: string
  emptyMessage: string
}) {
  const [searchTitle, setSearchTitle] = useState('')
  const [searchTech, setSearchTech] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const userMap = useMemo(() => new Map(usersList.map((u) => [u.id, u.abbreviation || u.name])), [usersList])
  const resolveTechName = (id?: string | null) => (id ? userMap.get(id) ?? id : 'Sem Atribuição')

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (searchTitle.trim() && !t.title.toLowerCase().includes(searchTitle.toLowerCase().trim())) return false
      if (searchTech.trim() && !resolveTechName(t.assignedTo).toLowerCase().includes(searchTech.toLowerCase().trim())) return false
      return true
    })
  }, [tasks, filterStatus, searchTitle, searchTech, userMap])

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort<Task>(
    filtered,
    {
      title: (t) => t.title?.toLowerCase(),
      assignee: (t) => resolveTechName(t.assignedTo).toLowerCase(),
      status: (t) => t.status,
      dueDate: (t) => t.createdAt ?? '',
    },
    null
  )

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm">
      {/* Header do Quadro */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
        <div className="flex items-center gap-2.5">
          <Icon className="text-safety-orange" size={22} />
          <div>
            <h3 className="text-base font-extrabold text-industrial-blue dark:text-slate-100">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sorted.length} de {tasks.length} em curso / pendentes
            </p>
          </div>
        </div>
        <Link
          href={viewAllHref}
          className="text-xs font-bold text-safety-orange hover:underline flex items-center gap-1 shrink-0"
        >
          Ver Todas <ArrowRight size={14} />
        </Link>
      </div>

      {/* Tabela com Filtros por Coluna */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[500px]">
          <thead>
            <tr className="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <SortableTh label="TÍTULO / EQUIPAMENTO" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="TÉCNICO" sortableKey="assignee" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="ESTADO" sortableKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="DATA" sortableKey="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </tr>

            {/* Linha de Filtros de Coluna */}
            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 p-1">
              <td className="p-1.5">
                <input
                  type="text"
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  placeholder="Filtrar título..."
                  className="input !text-[11px] !py-0.5 !px-2 w-full"
                />
              </td>
              <td className="p-1.5">
                <input
                  type="text"
                  value={searchTech}
                  onChange={(e) => setSearchTech(e.target.value)}
                  placeholder="Filtrar técnico..."
                  className="input !text-[11px] !py-0.5 !px-2 w-full"
                />
              </td>
              <td className="p-1.5">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="input !text-[11px] !py-0.5 !px-1 w-full"
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em Curso</option>
                </select>
              </td>
              <td className="p-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  <Filter className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              sorted.slice(0, 6).map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                >
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                    <div className="flex items-center gap-1.5">
                      <TipoBadge tipo={(item as any).tipo || 'curativa'} codeOnly={true} />
                      <Link href={viewAllHref} className="block group-hover:text-safety-orange transition-colors truncate max-w-[180px]">
                        {item.title}
                      </Link>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      {resolveTechName(item.assignedTo)}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusStyles(item.status, item.criticidade)}`}>
                      {getStatusLabel(item.status, item.criticidade)}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DashboardTablesClient({
  normalTasks,
  projectTasks,
  usersList,
}: {
  normalTasks: Task[]
  projectTasks: Task[]
  usersList: User[]
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Quadro Esquerdo: OTs Ativas e Atribuídas */}
      <TableSection
        title="OTs Ativas e Atribuídas"
        icon={ClipboardList}
        tasks={normalTasks}
        usersList={usersList}
        viewAllHref="/dashboard/tasks"
        emptyMessage="Nenhuma OT ativa registada."
      />

      {/* Quadro Direito: Resumo de Projetos */}
      <TableSection
        title="Projetos"
        icon={FolderKanban}
        tasks={projectTasks}
        usersList={usersList}
        viewAllHref="/dashboard/projects"
        emptyMessage="Nenhum projeto ativo registado."
      />
    </div>
  )
}
