'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import {
  createTask, updateTask, deleteTask, getTask,
  listPlanTaskRefs, type PlanTaskRef,
  listStockItems,
  calculateTaskCost,
} from '@/lib/firebase/data'
import type { TaskCriticidade, TipoTarefa, TaskStatus } from '@/types/models'

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
const TIPOS: TipoTarefa[] = ['preventiva', 'curativa', 'plano', 'inspecao', 'lubrificacao', 'calibracao', 'outro']
const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'done', 'cancelled']

function parseProjectTask(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) throw new Error('O título é obrigatório.')

  const assetId = String(formData.get('assetId') ?? '').trim() || null

  const criticidade = String(formData.get('criticidade') ?? 'verde') as TaskCriticidade
  const tipo = String(formData.get('tipo') ?? 'curativa') as TipoTarefa
  const status = String(formData.get('status') ?? 'pending') as TaskStatus

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

  return {
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    assetId,
    assignedTo: String(formData.get('assignedTo') ?? '').trim() || null,
    criticidade: CRITICIDADES.includes(criticidade) ? criticidade : 'verde',
    tipo: TIPOS.includes(tipo) ? tipo : 'curativa',
    status: STATUSES.includes(status) ? status : 'pending',
    dueDate: String(formData.get('dueDate') ?? '').trim() || null,
    safetyRules: parseStringArray('safetyRules'),
    materialsRequired: parseStringArray('materialsRequired'),
    maintenancePlanId,
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
    await createTask(profile.companyId, profile.id, parseProjectTask(formData))
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/tasks')
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
    await updateTask(profile.companyId, id, parseProjectTask(formData))
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/tasks')
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

  if (profile.role === 'technician') {
    const task = await getTask(profile.companyId, taskId)
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
    await updateTask(profile.companyId, taskId, { status: newStatus })
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
