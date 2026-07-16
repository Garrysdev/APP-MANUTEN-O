import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listAssets, listInterventions, listUsers } from '@/lib/firebase/data'
import { STATUS_LABELS, CRITICIDADE_LABELS, TIPO_LABELS, type TipoTarefa } from '@/types/models'
import { formatDate, formatDateTime, formatDuration } from '@/lib/utils'
import PrintButton from './PrintButton'
import CSVExportButton from './CSVExportButton'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'technician') redirect('/dashboard/tasks')

  const [tasks, assets, interventions, users] = await Promise.all([
    listTasks(profile.companyId),
    listAssets(profile.companyId),
    listInterventions(profile.companyId),
    listUsers(profile.companyId),
  ])

  const companyName = profile.company?.name ?? 'Empresa'
  const generatedAt = new Date().toLocaleString('pt-PT')

  const done = tasks.filter((t) => t.status === 'done').length
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length
  const pending = tasks.filter((t) => t.status === 'pending').length
  const urgentOpen = tasks.filter(
    (t) => t.criticidade === 'vermelho' && t.status !== 'done' && t.status !== 'cancelled'
  ).length
  // Tarefas pendentes/em curso de TODOS os tipos (tarefa 14: incluir os restantes tipos)
  const openTasks = tasks
    .filter((t) => t.status === 'pending' || t.status === 'in_progress')
    .sort((a, b) => (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1)

  // Distribuição por tipo de tarefa (todas as tarefas)
  const TIPOS_ORDEM: TipoTarefa[] = ['preventiva', 'curativa', 'plano', 'inspecao', 'lubrificacao', 'calibracao', 'outro']
  const porTipo = TIPOS_ORDEM
    .map((tipo) => ({ tipo, total: tasks.filter((t) => t.tipo === tipo).length }))
    .filter((x) => x.total > 0)

  const assetMap = Object.fromEntries(assets.map((a) => [a.id, a.name]))
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          nav, aside { display: none !important; }
          .print-header { display: block !important; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
          .page-break { page-break-before: always; }
          body { font-size: 10.5pt; }
          @page { margin: 14mm 12mm; }
        }
      ` }} />

      <div className="max-w-5xl mx-auto">
        {/* Cabeçalho (ecrã) */}
        <div className="flex items-start justify-between mb-6 no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Relatórios</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{companyName} · gerado em {generatedAt}</p>
          </div>
          <div className="flex gap-2">
            <CSVExportButton
              tasks={tasks}
              interventions={interventions}
              userMap={userMap}
              assetMap={assetMap}
            />
            <PrintButton />
          </div>
        </div>

        {/* Cabeçalho (impressão) — oculto no ecrã */}
        <div className="hidden print-header mb-6" style={{ display: 'none' }}>
          <div className="flex items-center justify-between border-b-2 border-[#1B4F72] pb-3 mb-4">
            <div>
              <h1 className="text-xl font-bold text-[#1B4F72]">RG Maintenance — {companyName}</h1>
              <p className="text-xs text-gray-500">Relatório de manutenção · {generatedAt}</p>
            </div>
            <span className="text-xs font-black text-[#1B4F72] border-2 border-[#1B4F72] px-2 py-1 rounded">RG</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total OTs', value: tasks.length, color: 'text-[#1B4F72]' },
            { label: 'Concluídas', value: done, color: 'text-green-600' },
            { label: 'Em curso', value: inProgress, color: 'text-blue-500' },
            { label: urgentOpen > 0 ? '⚠ Urgentes abertas' : 'Pendentes', value: urgentOpen > 0 ? urgentOpen : pending, color: urgentOpen > 0 ? 'text-red-600' : 'text-orange-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center">
              <p className={`text-3xl font-black ${color.includes('text-[#1B4F72]') ? 'text-[#1B4F72] dark:text-blue-400' : color}`}>{value}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8 text-center">
          <div className="card p-3">
            <p className="text-xl font-bold text-gray-800 dark:text-slate-200">{interventions.length}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Intervenções registadas</p>
          </div>
          <div className="card p-3">
            <p className="text-xl font-bold text-gray-800 dark:text-slate-200">{assets.filter(a => a.active).length}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Equipamentos ativos</p>
          </div>
          <div className="card p-3">
            <p className="text-xl font-bold text-gray-800 dark:text-slate-200">{tasks.filter(t => t.tipo === 'preventiva').length}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">OTs preventivas</p>
          </div>
        </div>

        {/* Distribuição por tipo de tarefa (todos os tipos) */}
        {porTipo.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span className="inline-block w-1 h-5 bg-[#1B4F72] rounded" />
              OTs por Tipo
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {porTipo.map(({ tipo, total }) => (
                <div key={tipo} className="card p-3">
                  <p className="text-xl font-bold text-gray-800 dark:text-slate-200">{total}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{TIPO_LABELS[tipo]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tarefas pendentes — todos os tipos */}
        {openTasks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span className="inline-block w-1 h-5 bg-[#1B4F72] rounded" />
              OTs Pendentes — Todos os Tipos
            </h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400">Ordem de Trabalho (OT)</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400 hidden sm:table-cell">Tipo</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400 hidden md:table-cell">Equipamento</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400">Prazo</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400">Estado</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400 hidden md:table-cell">Criticidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                  {openTasks.map((t) => {
                    const isOverdue = t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-slate-200">{t.title}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-slate-400 text-xs hidden sm:table-cell">{TIPO_LABELS[t.tipo] ?? t.tipo}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-slate-400 hidden md:table-cell">{assetMap[t.assetId ?? ''] ?? '—'}</td>
                        <td className={`px-4 py-2.5 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-slate-400'}`}>
                          {formatDate(t.dueDate ?? null)}
                          {isOverdue && ' ⚠'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`badge-${t.status}`}>{STATUS_LABELS[t.status]}</span>
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          <span className="inline-flex items-center gap-1 text-xs font-medium">
                            <span className={`inline-block w-2 h-2 rounded-full ${
                              t.criticidade === 'vermelho' ? 'bg-red-500' :
                              t.criticidade === 'amarelo' ? 'bg-yellow-400' : 'bg-green-500'
                            }`} />
                            {CRITICIDADE_LABELS[t.criticidade]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Histórico de intervenções */}
        <div className="page-break">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="inline-block w-1 h-5 bg-[#1B4F72] rounded" />
            Histórico de Intervenções
            <span className="text-sm font-normal text-gray-400 dark:text-slate-500">({interventions.length})</span>
          </h2>

          {interventions.length === 0 ? (
            <div className="card px-5 py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
              Sem intervenções registadas.
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-800">
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400">Data</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400">Técnico</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400 hidden md:table-cell">Equipamento</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400">Duração</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-slate-400 hidden lg:table-cell">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                  {interventions.map((iv) => {
                    const task = tasks.find((t) => t.id === iv.taskId)
                    const asset = task?.assetId ? assets.find((a) => a.id === task.assetId) : null
                    return (
                      <tr key={iv.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(iv.startedAt ?? iv.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-slate-200">
                          {userMap[iv.technicianId] ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-slate-400 hidden md:table-cell">
                          {asset?.name ?? task?.title ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDuration(iv.startedAt ?? null, iv.endedAt ?? null)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400 text-xs hidden lg:table-cell max-w-xs truncate">
                          {iv.observations ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-8 text-xs text-gray-400 dark:text-slate-500 text-center no-print">
          RG Maintenance · {companyName} · {generatedAt}
        </p>
      </div>
    </>
  )
}
