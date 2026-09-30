'use server'

/**
 * Núcleo partilhado das ações de técnico que também precisam de funcionar a partir da
 * sincronização offline (src/app/api/sync/technician/route.ts). Cada Server Action em
 * src/app/dashboard/tasks/actions.ts e src/app/dashboard/tasks/[id]/actions.ts continua a
 * ser o ponto de entrada normal (parseia FormData, chama isto), e a rota de sync chama
 * exatamente as mesmas funções aqui — nunca a lógica de autorização/validação
 * reimplementada em paralelo num sítio só.
 *
 * `expectedUpdatedAt` só é fornecido pela rota de sync (uma mutação que ficou em fila
 * offline sabe a que `updatedAt` da OT ela correspondia quando foi feita). O caminho
 * online normal (chamada direta da Server Action, sem fila) não o passa — mantém o
 * comportamento de sempre: sem verificação de conflito, porque não houve espera nenhuma
 * entre o utilizador ver a OT e gravar a alteração.
 */

import {
  getTask,
  updateTask,
  calculateTaskCost,
  createIntervention,
  countInterventionsThisMonth,
} from '@/lib/firebase/data'
import { isTechnicianAllowedOnTask } from '@/lib/task-assignment'
import { LIMITS } from '@/lib/plans'
import { STATUS_LABELS } from '@/types/models'
import type { ChecklistItem, PlanName, TaskStatus, UserProfile } from '@/types/models'

export type GuardedResult =
  | { ok: true }
  | { ok: false; error: string; conflict?: boolean }

function isStale(task: { updatedAt?: string | null }, expectedUpdatedAt?: string): boolean {
  if (!expectedUpdatedAt) return false
  return Boolean(task.updatedAt && task.updatedAt !== expectedUpdatedAt)
}

const CONFLICT_MSG = 'Esta OT foi alterada entretanto (por outra pessoa ou noutro dispositivo) — revê os dados atuais antes de submeter de novo.'

export async function changeTaskStatus(params: {
  companyId: string
  profile: UserProfile
  taskId: string
  newStatus: TaskStatus
  expectedUpdatedAt?: string
}): Promise<GuardedResult> {
  const { companyId, profile, taskId, newStatus, expectedUpdatedAt } = params
  if (!(newStatus in STATUS_LABELS)) return { ok: false, error: 'Estado inválido.' }

  const task = await getTask(companyId, taskId)
  if (!task) return { ok: false, error: 'Tarefa não encontrada.' }
  if (profile.role === 'technician' && !isTechnicianAllowedOnTask(profile, task)) {
    return { ok: false, error: 'Sem permissão para alterar o estado desta tarefa.' }
  }
  if (isStale(task, expectedUpdatedAt)) return { ok: false, error: CONFLICT_MSG, conflict: true }

  const now = new Date().toISOString()
  const extra: { startedAt?: string; completedAt?: string } = {}
  if ((newStatus === 'in_progress' || newStatus === 'done') && !task.startedAt) extra.startedAt = now
  if (newStatus === 'done' && !task.completedAt) extra.completedAt = now
  await updateTask(companyId, taskId, { status: newStatus, ...extra })
  if (newStatus === 'done') await calculateTaskCost(companyId, taskId)
  return { ok: true }
}

export async function updateTaskFRsAndITs(params: {
  companyId: string
  taskId: string
  data: { completedFRs?: Record<string, any> | null; acknowledgedITs?: string[] | null }
  expectedUpdatedAt?: string
}): Promise<GuardedResult> {
  const { companyId, taskId, data, expectedUpdatedAt } = params
  if (expectedUpdatedAt) {
    const task = await getTask(companyId, taskId)
    if (!task) return { ok: false, error: 'Tarefa não encontrada.' }
    if (isStale(task, expectedUpdatedAt)) return { ok: false, error: CONFLICT_MSG, conflict: true }
  }
  await updateTask(companyId, taskId, data)
  return { ok: true }
}

export async function updateTaskExecutionDetails(params: {
  companyId: string
  taskId: string
  data: {
    observacoes?: string
    photoUrl?: string
    safetyRulesChecked?: string[]
    frsChecked?: string[]
  }
  expectedUpdatedAt?: string
}): Promise<GuardedResult> {
  const { companyId, taskId, data, expectedUpdatedAt } = params
  const task = await getTask(companyId, taskId)
  if (!task) return { ok: false, error: 'Tarefa não encontrada.' }
  if (isStale(task, expectedUpdatedAt)) return { ok: false, error: CONFLICT_MSG, conflict: true }

  const updateData: any = {}
  if (data.observacoes !== undefined) {
    updateData.observacoes = data.observacoes
    updateData.description = data.observacoes || task.description
  }
  if (data.photoUrl) {
    updateData.photoUrl = data.photoUrl
    const existingPhotos = Array.isArray((task as any).photos) ? (task as any).photos : []
    if (!existingPhotos.includes(data.photoUrl)) {
      updateData.photos = [...existingPhotos, data.photoUrl]
    }
  }
  if (data.safetyRulesChecked !== undefined) updateData.safetyRulesChecked = data.safetyRulesChecked
  if (data.frsChecked !== undefined) updateData.frsChecked = data.frsChecked

  await updateTask(companyId, taskId, updateData)
  return { ok: true }
}

/**
 * Fase 1: cria o registo de intervenção (checklist, observações, fotos já enviadas,
 * opcionalmente muda o estado da OT) SEM materiais inline / desconto de stock — essa
 * parte fica para a Fase 2 (risco real de conflito quando dois técnicos offline
 * descontam o mesmo artigo). O caminho degradado já disponível: o técnico cria a
 * intervenção offline e adiciona materiais mais tarde, já online, por
 * createMaterialAction (inalterado).
 */
export type CreateInterventionResult =
  | { ok: true; interventionId: string }
  | { ok: false; error: string; conflict?: boolean }

export async function createInterventionCore(params: {
  companyId: string
  profile: UserProfile
  taskId: string
  clientId?: string
  data: {
    technicianId?: string | null
    startedAt?: string | null
    endedAt?: string | null
    observations?: string | null
    checklist?: ChecklistItem[]
    photoUrls?: string[] | null
    newStatus?: TaskStatus | ''
  }
  expectedUpdatedAt?: string
}): Promise<CreateInterventionResult> {
  const { companyId, profile, taskId, clientId, data, expectedUpdatedAt } = params

  const task = await getTask(companyId, taskId)
  if (!task) return { ok: false, error: 'Tarefa não encontrada.' }
  if (profile.role === 'technician' && !isTechnicianAllowedOnTask(profile, task)) {
    return { ok: false, error: 'Sem permissão para registar intervenção nesta tarefa.' }
  }
  if (isStale(task, expectedUpdatedAt)) return { ok: false, error: CONFLICT_MSG, conflict: true }

  const plan = (profile.company?.plan ?? 'free') as PlanName
  const monthCount = await countInterventionsThisMonth(companyId)
  const { interventionsPerMonth } = LIMITS[plan]
  if (monthCount >= interventionsPerMonth) {
    return { ok: false, error: `Limite de ${interventionsPerMonth} intervenção(ões) por mês atingido no plano ${plan}.` }
  }

  const interventionId = await createIntervention(
    companyId,
    {
      taskId,
      technicianId: data.technicianId || profile.id,
      startedAt: data.startedAt || null,
      endedAt: data.endedAt || null,
      observations: data.observations || null,
      checklist: data.checklist || [],
      photoUrls: data.photoUrls || null,
    },
    clientId
  )

  if (data.newStatus) {
    await updateTask(companyId, taskId, { status: data.newStatus })
    if (data.newStatus === 'done') await calculateTaskCost(companyId, taskId)
  } else if (task.status === 'done') {
    await calculateTaskCost(companyId, taskId)
  }

  return { ok: true, interventionId }
}
