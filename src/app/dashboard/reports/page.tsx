import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listAssets, listInterventions, listUsers, getTasksForYearStats, listMaintenancePlans } from '@/lib/firebase/data'
import { STATUS_LABELS, CRITICIDADE_LABELS, TIPO_LABELS, type TipoTarefa } from '@/types/models'
import { formatDate, formatDateTime, formatDuration } from '@/lib/utils'
import PrintButton from './PrintButton'
import CSVExportButton from './CSVExportButton'
import ReportsChartsClient from './ReportsChartsClient'
import CriticalAssetsTable from './CriticalAssetsTable'
import { planHas } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const EARLIEST_YEAR = 2017

export default async function ReportsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'manager') redirect('/dashboard/tasks')

  const plan = profile.company?.plan ?? 'free'
  if (!planHas(plan, 'reports')) redirect('/dashboard/billing?feature=reports')

  // Histórico completo montado a partir de queries pequenas por ano (cada uma
  // cacheável e barata), em vez de um único listTasks() sem limite — que com o
  // histórico da UR (~6700 OTs) excede o tecto de 2MB da Data Cache do Next.js e
  // esgota a quota diária do Firestore a cada carregamento desta página.
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = currentYear + 1; y >= EARLIEST_YEAR; y--) years.push(y)

  const [yearlyTasks, assets, interventions, users, plans] = await Promise.all([
    Promise.all(years.map((y) => getTasksForYearStats(profile.companyId, y))),
    listAssets(profile.companyId),
    listInterventions(profile.companyId),
    listUsers(profile.companyId),
    listMaintenancePlans(profile.companyId),
  ])
  const tasks = yearlyTasks.flat()

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

  const criticalAssets = assets.map((asset) => {
    const assetTasks = tasks.filter((t) => t.assetId === asset.id || t.tag === asset.tag)
    const openUrgent = assetTasks.filter((t) => t.criticidade === 'vermelho' && t.status !== 'done' && t.status !== 'cancelled').length
    return {
      id: asset.id,
      area: asset.area ?? null,
      tag: asset.tag ?? null,
      name: asset.name,
      active: asset.active !== false,
      criticidadeABC: asset.criticidadeABC || 'C',
      totalTasks: assetTasks.length,
      openUrgent,
    }
  })

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Estatísticas e Gráficos</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{companyName} · Análise de KPIs e gráficos gerado em {generatedAt}</p>
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

        {/* Seção Exclusiva de Gráficos e Valores de KPI com PM e PI no topo */}

        {/* Seção Exclusiva de Gráficos e Valores Mensais de KPI */}
        <ReportsChartsClient
          tasks={tasks}
          assets={assets}
          interventions={interventions}
          plans={plans}
        />

        {/* Análise dos Equipamentos Mais Críticos */}
        <div className="mt-8">
          <h2 className="text-base font-bold text-gray-800 dark:text-slate-200 mb-3 flex items-center justify-between">
            <span>Análise dos Equipamentos Mais Críticos</span>
            <Link href="/dashboard/assets" className="text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline">
              Ver Todos os Equipamentos →
            </Link>
          </h2>
          {criticalAssets.length === 0 ? (
            <div className="card px-5 py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
              Sem equipamentos cadastrados.
            </div>
          ) : (
            <CriticalAssetsTable rows={criticalAssets} />
          )}
        </div>



        <p className="mt-8 text-xs text-gray-400 dark:text-slate-500 text-center no-print">
          RG Maintenance · {companyName} · {generatedAt}
        </p>
      </div>
    </>
  )
}
