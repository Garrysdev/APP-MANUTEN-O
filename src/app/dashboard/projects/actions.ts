'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import {
  createTask, updateTask, deleteTask, getTask,
  listPlanTaskRefs, type PlanTaskRef,
  listStockItems, listAssetRefs, listTasks,
  calculateTaskCost,
} from '@/lib/firebase/data'
import { adminDb } from '@/lib/firebase/admin'
import type { Task, TaskCriticidade, TipoTarefa, TaskStatus } from '@/types/models'

export type TaskFormState = { error?: string; ok?: boolean }
export type StockMaterialRef = { id: string; name: string; unit: string | null }

export async function loadStockRefsAction(): Promise<StockMaterialRef[]> {
  const profile = await getCurrentProfile()
  if (!profile) return []
  const items = await listStockItems(profile.companyId)
  return items.map((s) => ({ id: s.id, name: s.name, unit: s.unit ?? null }))
}

export async function loadPlanTaskRefsAction(): Promise<PlanTaskRef[]> {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return []
  return listPlanTaskRefs(profile.companyId)
}

const CRITICIDADES: TaskCriticidade[] = ['vermelho', 'amarelo', 'verde']
const TIPOS: TipoTarefa[] = ['preventiva', 'curativa', 'mi', 'plano', 'pi', 'stp', 'inspecao', 'lubrificacao', 'calibracao', 'outro']
const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'done', 'cancelled']

function parseProjectTask(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) throw new Error('O Título / Descrição é um campo obrigatório.')

  const assetId = String(formData.get('assetId') ?? '').trim() || null

  const criticidade = String(formData.get('criticidade') ?? 'verde') as TaskCriticidade
  const tipo = String(formData.get('tipo') ?? 'curativa') as TipoTarefa
  const rawStatus = String(formData.get('status') ?? 'pending') as TaskStatus
  const dueDate = String(formData.get('dueDate') ?? '').trim() || null
  const plannedStartDate = String(formData.get('plannedStartDate') ?? '').trim() || null

  let status = STATUSES.includes(rawStatus) ? rawStatus : 'pending'
  if (!dueDate && (status === 'done' || status === 'cancelled')) {
    status = 'pending'
  }

  function parseStringArray(key: string): string[] | null {
    try {
      const raw = String(formData.get(key) ?? '').trim()
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const items = parsed.map((r) => String(r).trim()).filter(Boolean).slice(0, 20)
        return items.length ? items : null
      }
    } catch { /* ignore */ }
    return null
  }

  const maintenancePlanId = String(formData.get('maintenancePlanId') ?? '').trim() || null
  const assignedToIds = parseStringArray('assignedToIds')
  const tag = String(formData.get('tag') ?? '').trim() || null
  const area = String(formData.get('area') ?? '').trim() || null
  const photoUrl = String(formData.get('photoUrl') ?? '').trim() || null
  const requesterEmail = String(formData.get('requesterEmail') ?? '').trim() || null
  const dependsOn = parseStringArray('dependsOn')

  return {
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    assetId,
    tag,
    area,
    photoUrl,
    requesterEmail,
    assignedTo: String(formData.get('assignedTo') ?? '').trim() || null,
    assignedToIds,
    criticidade: CRITICIDADES.includes(criticidade) ? criticidade : 'verde',
    tipo: TIPOS.includes(tipo) ? tipo : 'curativa',
    status,
    dueDate,
    plannedStartDate,
    startedAt: String(formData.get('startedAt') ?? '').trim() || (status === 'in_progress' || status === 'done' ? new Date().toISOString() : null),
    completedAt: String(formData.get('completedAt') ?? '').trim() || (status === 'done' ? (dueDate || new Date().toISOString()) : null),
    observacoes: String(formData.get('observacoes') ?? '').trim() || null,
    safetyRules: parseStringArray('safetyRules'),
    materialsRequired: parseStringArray('materialsRequired'),
    requiredFRs: parseStringArray('requiredFRs'),
    requiredITs: parseStringArray('requiredITs'),
    maintenancePlanId,
    dependsOn,
    source: 'folha_projetos',
    isProject: true,
  }
}

export async function createProjectTaskAction(
  _prev: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  try {
    const parsed = parseProjectTask(formData)
    if (!parsed.assetId) {
      parsed.assetId = parsed.tag || parsed.area || 'Geral'
    }
    const assetRefs = await listAssetRefs(profile.companyId)
    const found = assetRefs.find(
      (a) => a.id === parsed.assetId || (a.tag && parsed.tag && a.tag.toLowerCase().trim() === parsed.tag.toLowerCase().trim())
    )
    if (found) {
      parsed.assetId = found.id
      if (!parsed.tag && found.tag) parsed.tag = found.tag
      if (!parsed.area && found.area) parsed.area = found.area
    }

    await createTask(profile.companyId, profile.id, {
      ...parsed,
      createdByName: profile.name,
    })
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar projeto.' }
  }
}

export async function updateProjectTaskAction(
  _prev: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'ID em falta.' }
  try {
    const parsed = parseProjectTask(formData)
    await updateTask(profile.companyId, id, parsed)

    if (parsed.dueDate) {
      await cascadeDependencyUpdates(profile.companyId, id, parsed.dueDate)
    }

    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar projeto.' }
  }
}

export async function deleteProjectTaskAction(id: string): Promise<TaskFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  try {
    await deleteTask(profile.companyId, id)
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao eliminar projeto.' }
  }
}

export async function updateProjectTaskStatusAction(
  taskId: string,
  newStatus: TaskStatus
): Promise<TaskFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

  const task = await getTask(profile.companyId, taskId)
  if (profile.role === 'technician') {
    if (!task) return { error: 'Tarefa não encontrada.' }
    if (task.assignedTo !== profile.id && task.createdBy !== profile.id) return { error: 'Sem permissão.' }
    const allowed: Partial<Record<TaskStatus, TaskStatus>> = {
      pending: 'in_progress',
      in_progress: 'done',
    }
    if (newStatus !== allowed[task.status]) return { error: 'Transição de estado inválida.' }
  } else if (!STATUSES.includes(newStatus)) {
    return { error: 'Estado inválido.' }
  }

  try {
    const now = new Date().toISOString()
    const extra: { startedAt?: string; completedAt?: string } = {}
    if ((newStatus === 'in_progress' || newStatus === 'done') && !task?.startedAt) extra.startedAt = now
    if (newStatus === 'done' && !task?.completedAt) extra.completedAt = now
    await updateTask(profile.companyId, taskId, { status: newStatus, ...extra })
    if (newStatus === 'done') {
      await calculateTaskCost(profile.companyId, taskId)
    }
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar estado.' }
  }
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr.slice(0, 10) + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function getDurationInDays(startStr: string, dueStr: string): number {
  const s = new Date(startStr.slice(0, 10) + 'T00:00:00').getTime()
  const e = new Date(dueStr.slice(0, 10) + 'T00:00:00').getTime()
  const days = Math.round((e - s) / 86400000)
  return Math.max(1, days + 1)
}

async function cascadeDependencyUpdates(companyId: string, predecessorId: string, predecessorDueDate: string): Promise<void> {
  try {
    const allTasks = await listTasks(companyId)
    const successors = allTasks.filter((t) => t.dependsOn && Array.isArray(t.dependsOn) && t.dependsOn.includes(predecessorId))
    
    for (const succ of successors) {
      const succStart = succ.plannedStartDate ? succ.plannedStartDate.slice(0, 10) : (succ.createdAt ? succ.createdAt.slice(0, 10) : predecessorDueDate)
      const succDue = succ.dueDate ? succ.dueDate.slice(0, 10) : succStart
      const succDuration = getDurationInDays(succStart, succDue)

      if (predecessorDueDate >= succStart) {
        const newStart = addDaysToDateStr(predecessorDueDate, 1)
        const newDue = addDaysToDateStr(newStart, succDuration - 1)
        await updateTask(companyId, succ.id, {
          plannedStartDate: newStart,
          dueDate: newDue,
        })
        await cascadeDependencyUpdates(companyId, succ.id, newDue)
      }
    }
  } catch (err) {
    console.error('Erro no cascateamento de dependências:', err)
  }
}

export async function updateProjectTaskDatesAction(
  taskId: string,
  plannedStartDate: string,
  dueDate: string
): Promise<TaskFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  try {
    const db = adminDb()
    if (taskId.startsWith('plan_')) {
      const parts = taskId.split('_')
      const planId = parts[1]
      if (planId) {
        await db.collection('maintenance_plans').doc(planId).update({
          calendarStartDate: plannedStartDate,
          nextDueDate: dueDate,
          scheduledDate: plannedStartDate,
          updatedAt: new Date().toISOString(),
        }).catch(() => null)
      }
      await updateTask(profile.companyId, taskId, {
        plannedStartDate,
        dueDate,
      })
    } else {
      await updateTask(profile.companyId, taskId, {
        plannedStartDate,
        dueDate,
      })
      await cascadeDependencyUpdates(profile.companyId, taskId, dueDate)
    }
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e: any) {
    const msg = e?.message || ''
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded')) {
      return { error: '⚠️ A cota diária do Firebase (Plano Gratuito Spark) foi atingida. Para tráfego ilimitado, ative o plano Blaze (Pay-as-you-go) na consola do Firebase.' }
    }
    return { error: e instanceof Error ? e.message : 'Erro ao reagendar data no Gantt.' }
  }
}
