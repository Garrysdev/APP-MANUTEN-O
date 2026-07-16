import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getTask, listAssets, listUsers, listInterventionsByTask, listMaterialsForInterventions, listStockItems } from '@/lib/firebase/data'
import {
  STATUS_LABELS,
  CRITICIDADE_LABELS,
  TIPO_LABELS,
} from '@/types/models'
import { formatDate } from '@/lib/utils'
import TaskDetailClient from './TaskDetailClient'
import TaskSummaryActions from './TaskSummaryActions'
import AITaskConsultant from './AITaskConsultant'
import CompliancePDFExport from './CompliancePDFExport'

export const dynamic = 'force-dynamic'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const task = await getTask(profile.companyId, id)
  if (!task) notFound()

  const [assets, users, interventions, stockItems] = await Promise.all([
    listAssets(profile.companyId),
    listUsers(profile.companyId),
    listInterventionsByTask(profile.companyId, id),
    listStockItems(profile.companyId),
  ])

  const taskAsset = assets.find((a) => a.id === task.assetId) ?? null

  const allMaterials = await listMaterialsForInterventions(
    profile.companyId,
    interventions.map((i) => i.id)
  )
  const materialsByIntervention: Record<string, typeof allMaterials> = {}
  for (const m of allMaterials) {
    if (!materialsByIntervention[m.interventionId]) materialsByIntervention[m.interventionId] = []
    materialsByIntervention[m.interventionId].push(m)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/dashboard/tasks" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#2E86C1] mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar às OTs
      </Link>

      {/* Resumo da tarefa */}
      <div className="card p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
            {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <span className={`badge-${task.status}`}>{STATUS_LABELS[task.status]}</span>
            {task.status === 'done' && (
              <a
                href={`/report/task/${task.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <FileText className="h-4 w-4" /> Relatório PDF
              </a>
            )}
            {profile.role === 'manager' && (
              <TaskSummaryActions
                task={task}
                assets={assets.map((a) => ({ id: a.id, name: a.name }))}
                users={users.map((u) => ({ id: u.id, name: u.name }))}
              />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Equipamento</p>
            <p className="text-gray-800 font-medium">{taskAsset?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Criticidade</p>
            <p className="text-gray-800 font-medium flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                task.criticidade === 'vermelho' ? 'bg-red-500' :
                task.criticidade === 'amarelo' ? 'bg-yellow-400' : 'bg-green-500'
              }`} />
              {CRITICIDADE_LABELS[task.criticidade]}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Prazo</p>
            <p className="text-gray-800 font-medium">{formatDate(task.dueDate ?? null)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Tipo</p>
            <p className="text-gray-800 font-medium">{TIPO_LABELS[task.tipo] ?? task.tipo}</p>
          </div>
        </div>

        <CompliancePDFExport 
          task={task}
          interventions={interventions}
          materialsByIntervention={materialsByIntervention}
          assetName={taskAsset?.name ?? '—'}
          companyName={profile.company?.name ?? 'RG Maintenance'}
          hasComplianceModule={profile.company?.activeModules?.includes('compliance-iso') ?? false}
        />
      </div>

      <AITaskConsultant 
        taskId={task.id}
        taskTitle={task.title}
        assetId={task.assetId ?? null}
        assetName={taskAsset?.name ?? null}
        interventionsCount={interventions.length}
        aiCredits={profile.company?.aiCredits || 0}
        hasAiModule={profile.company?.activeModules?.includes('ai-consultant') ?? false}
      />

      <TaskDetailClient
        taskId={task.id}
        taskStatus={task.status}
        users={users.map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }))}
        interventions={interventions}
        materialsByIntervention={materialsByIntervention}
        safetyRules={task.safetyRules ?? null}
        stockItems={stockItems.map((s) => ({
          id: s.id,
          name: s.name,
          reference: s.reference ?? null,
          unit: s.unit ?? null,
          unitCost: s.unitCost ?? null,
          quantity: s.quantity,
        }))}
      />
    </div>
  )
}
