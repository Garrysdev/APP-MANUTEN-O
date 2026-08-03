import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listAssets, listInterventions, listUsers } from '@/lib/firebase/data'
import { STATUS_LABELS, CRITICIDADE_LABELS, TIPO_LABELS, type TipoTarefa } from '@/types/models'
import { formatDate, formatDateTime, formatDuration } from '@/lib/utils'
import PrintButton from './PrintButton'
import CSVExportButton from './CSVExportButton'
import ReportsChartsClient from './ReportsChartsClient'
import { planHas } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'technician') redirect('/dashboard/tasks')

  const plan = profile.company?.plan ?? 'free'
  if (!planHas(plan, 'reports')) redirect('/dashboard/billing')

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

  // Distribuição por tipo de tarefa (incluindo PI - Pedido de Intervenção)
  const TIPOS_ORDEM: TipoTarefa[] = ['preventiva', 'curativa', 'plano', 'pi', 'inspecao', 'lubrificacao', 'calibracao', 'outro']
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Estatísticas & Relatórios</h1>
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
              <p className="text-xs text-gray-500">Relatório de estatísticas & KPIs · {generatedAt}</p>
            </div>
            <span className="text-xs font-black text-[#1B4F72] border-2 border-[#1B4F72] px-2 py-1 rounded">RG</span>
          </div>
        </div>

        {/* KPIs principais */}
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

        {/* Seção Exclusiva de Gráficos e Valores Mensais de KPI */}
        <ReportsChartsClient
          tasks={tasks}
          assets={assets}
          interventions={interventions}
        />

        {/* Análise dos Equipamentos Mais Críticos */}
        <div className="mt-8">
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-200 mb-3">Análise dos Equipamentos Mais Críticos</h2>
          {criticalAssets.length === 0 ? (
            <div className="card px-5 py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
              Sem equipamentos cadastrados.
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[650px] md:min-w-0">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                      <th className="text-left px-3 py-2.5">ÁREA</th>
                      <th className="text-left px-3 py-2.5">TAG</th>
                      <th className="text-left px-3 py-2.5">EQUIPAMENTO</th>
                      <th className="text-center px-3 py-2.5">CRITICIDADE ABC</th>
                      <th className="text-center px-3 py-2.5">TOTAL OTs</th>
                      <th className="text-center px-3 py-2.5">URGENTES EM ABERTO</th>
                      <th className="text-center px-3 py-2.5">ESTADO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {criticalAssets.map(({ asset, totalTasks, openUrgent, criticidadeABC }) => (
                      <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {asset.area || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {asset.tag || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                          {asset.name}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-extrabold ${
                            criticidadeABC === 'A' ? 'bg-red-100 text-red-800 border border-red-300' :
                            criticidadeABC === 'B' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}>
                            Classe {criticidadeABC}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold font-mono text-slate-800 dark:text-slate-200">
                          {totalTasks}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono">
                          {openUrgent > 0 ? (
                            <span className="bg-red-50 text-red-700 font-extrabold px-2 py-0.5 rounded border border-red-200">
                              ⚠️ {openUrgent}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${asset.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-300'}`}>
                            {asset.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
