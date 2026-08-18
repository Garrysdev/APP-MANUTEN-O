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
            {(profile.role === 'manager' || profile.email === 'garrido.rui@gmail.com' || (profile.name || '').toLowerCase().includes('rg')) && (
              <TaskSummaryActions
                task={task}
                assets={assets.map((a) => ({ id: a.id, name: a.name }))}
                users={users.map((u) => ({ id: u.id, name: u.name }))}
              />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-5 text-sm pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-[11px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Equipamento</p>
            {taskAsset ? (
              <Link href={`/dashboard/assets/${taskAsset.id}`} className="text-industrial-blue font-bold hover:underline flex items-center gap-1">
                {taskAsset.name}
              </Link>
            ) : (
              <p className="text-gray-800 dark:text-slate-200 font-medium">—</p>
            )}
            <p className="text-[11px] text-gray-400">
              {task.tag ? `TAG: ${task.tag}` : ''} {task.area ? `(Área ${task.area})` : ''}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Criada Por (ERP)</p>
            <p className="text-gray-900 dark:text-slate-100 font-bold">
              {(() => {
                const u = users.find((usr) => usr.id === task.createdBy || usr.email === task.createdBy)
                return task.createdByName || u?.name || 'Gestor / ERP'
              })()}
            </p>
            <p className="text-[11px] text-gray-400">
              {task.createdAt ? formatDate(task.createdAt) : ''}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Técnico(s)</p>
            <p className="text-gray-800 dark:text-slate-200 font-medium">
              {(() => {
                const ids = (task.assignedToIds && task.assignedToIds.length > 0)
                  ? task.assignedToIds
                  : (task.assignedTo ? [task.assignedTo] : [])
                if (ids.length === 0) return '—'
                return ids.map((idOrAbbr) => {
                  const u = users.find(usr => usr.id === idOrAbbr || usr.abbreviation === idOrAbbr)
                  return u ? (u.abbreviation || u.name) : idOrAbbr
                }).join(', ')
              })()}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Tipo / TI</p>
            <p className="text-gray-800 dark:text-slate-200 font-bold">
              {task.ti ? `${task.ti} (${task.tipoText || TIPO_LABELS[task.tipo] || task.tipo})` : (TIPO_LABELS[task.tipo] ?? task.tipo)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Criticidade</p>
            <p className="text-gray-800 dark:text-slate-200 font-medium flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                task.criticidade === 'vermelho' ? 'bg-red-500' :
                task.criticidade === 'amarelo' ? 'bg-yellow-400' : 'bg-green-500'
              }`} />
              {CRITICIDADE_LABELS[task.criticidade]}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Prazo / Início</p>
            <p className="text-gray-800 dark:text-slate-200 font-medium">
              {formatDate(task.plannedStartDate || task.dueDate || null)}
            </p>
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
        taskAssetId={task.assetId ?? null}
        requiredFRs={task.requiredFRs ?? []}
        requiredITs={task.requiredITs ?? []}
        completedFRs={task.completedFRs ?? {}}
        acknowledgedITs={task.acknowledgedITs ?? []}
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
          assetId: s.assetId ?? null,
          assetIds: s.assetIds ?? null,
        }))}
      />
    </div>
  )
}
