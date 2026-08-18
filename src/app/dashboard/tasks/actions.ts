'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import {
  createTask, updateTask, deleteTask, getTask,
  listPlanTaskRefs, type PlanTaskRef,
  listStockItems, listAssetRefs,
  calculateTaskCost,
} from '@/lib/firebase/data'
import type { TaskCriticidade, TipoTarefa, TaskStatus } from '@/types/models'

export type TaskFormState = { error?: string; ok?: boolean }
export type StockMaterialRef = {
  id: string
  name: string
  unit: string | null
  assetId?: string | null
  assetIds?: string[] | null
}

/** Materiais para o picker "Materiais a utilizar" — carregado sob demanda ao abrir o modal (tarefa 09). */
export async function loadStockRefsAction(): Promise<StockMaterialRef[]> {
  const profile = await getCurrentProfile()
  if (!profile) return []
  const items = await listStockItems(profile.companyId)
  return items.map((s) => ({
    id: s.id,
    name: s.name,
    unit: s.unit ?? null,
    assetId: s.assetId ?? null,
    assetIds: s.assetIds ?? null,
  }))
}

/** Carrega os planos (leves) só quando o utilizador abre o modal de criação — evita pesá-los em cada visita. */
export async function loadPlanTaskRefsAction(): Promise<PlanTaskRef[]> {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'manager') return []
  return listPlanTaskRefs(profile.companyId)
}

const CRITICIDADES: TaskCriticidade[] = ['vermelho', 'amarelo', 'verde']
const TIPOS: TipoTarefa[] = ['preventiva', 'curativa', 'plano', 'pi', 'stp', 'inspecao', 'lubrificacao', 'calibracao', 'outro']
const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'done', 'cancelled']

function parseTask(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) throw new Error('O título é obrigatório.')

  const assetId = String(formData.get('assetId') ?? '').trim() || null

  const criticidade = String(formData.get('criticidade') ?? 'verde') as TaskCriticidade
  const tipo = String(formData.get('tipo') ?? 'preventiva') as TipoTarefa
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
  const assignedToIds = parseStringArray('assignedToIds')

  const tag = String(formData.get('tag') ?? '').trim() || null
  const area = String(formData.get('area') ?? '').trim() || null
  const photoUrl = String(formData.get('photoUrl') ?? '').trim() || null
  const periodicidade = String(formData.get('periodicidade') ?? 'mensal').trim() || null
  const addToMaintenancePlan = formData.get('addToMaintenancePlan') === 'true' || formData.get('addToMaintenancePlan') === 'on'

  return {
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    assetId,
    tag,
    area,
    photoUrl,
    periodicidade,
    addToMaintenancePlan,
    assignedTo: String(formData.get('assignedTo') ?? '').trim() || null,
    assignedToIds,
    criticidade: CRITICIDADES.includes(criticidade) ? criticidade : 'verde',
    tipo: TIPOS.includes(tipo) ? tipo : 'preventiva',
    status: STATUSES.includes(status) ? status : 'pending',
    dueDate: String(formData.get('dueDate') ?? '').trim() || null,
    plannedStartDate: String(formData.get('plannedStartDate') ?? '').trim() || null,
    observacoes: String(formData.get('observacoes') ?? '').trim() || null,
    safetyRules: parseStringArray('safetyRules'),
    materialsRequired: parseStringArray('materialsRequired'),
    requiredFRs: parseStringArray('requiredFRs'),
    requiredITs: parseStringArray('requiredITs'),
    maintenancePlanId,
  }
}

export async function updateTaskFRsAndITsAction(
  taskId: string,
  data: {
    completedFRs?: Record<string, any> | null
    acknowledgedITs?: string[] | null
  }
): Promise<TaskFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  try {
    await updateTask(profile.companyId, taskId, data)
    revalidatePath('/dashboard/tasks')
    revalidatePath(`/dashboard/tasks/${taskId}`)
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao guardar dados de registo.' }
  }
}

export async function createTaskAction(
  _prev: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  try {
    const parsed = parseTask(formData)
    if (parsed.assetId && (!parsed.tag || !parsed.area)) {
      const assetRefs = await listAssetRefs(profile.companyId)
      const found = assetRefs.find((a) => a.id === parsed.assetId)
      if (found) {
        if (!parsed.tag && found.tag) parsed.tag = found.tag
        if (!parsed.area && found.area) parsed.area = found.area
      }
    }

    if (parsed.addToMaintenancePlan && parsed.periodicidade) {
      const { createMaintenancePlan } = await import('@/lib/firebase/data')
      const { periodicidadeToRecurrence } = await import('@/types/models')
      const periodOk = (parsed.periodicidade as any) || 'mensal'
      const { recurrence, recurrenceValue } = periodicidadeToRecurrence(periodOk)
      await createMaintenancePlan(profile.companyId, profile.id, {
        title: parsed.title,
        description: parsed.description,
        assetId: parsed.assetId,
        tag: parsed.tag,
        area: parsed.area,
        criticidade: parsed.criticidade,
        tipo: parsed.tipo || 'preventiva',
        periodicidade: periodOk,
        periodicidadeLabel: parsed.periodicidade,
        recurrence,
        recurrenceValue,
        executor: 'interno',
        legal: false,
        active: true,
        safetyRules: parsed.safetyRules,
      }).catch(console.error)
    }

    await createTask(profile.companyId, profile.id, {
      ...parsed,
      createdByName: profile.name,
    })
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/maintenance-plan')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar tarefa.' }
  }
}

export async function updateTaskAction(
  _prev: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'ID em falta.' }
  try {
    await updateTask(profile.companyId, id, parseTask(formData))
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/maintenance-plan')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar tarefa.' }
  }
}

export async function deleteTaskAction(id: string): Promise<TaskFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  try {
    await deleteTask(profile.companyId, id)
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/maintenance-plan')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao eliminar tarefa.' }
  }
}

/** Permite alterar estado da OT (pending → in_progress → done) com revalidação imediata. */
export async function updateTaskStatusAction(
  taskId: string,
  newStatus: TaskStatus
): Promise<TaskFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

  if (!STATUSES.includes(newStatus)) {
    return { error: 'Estado inválido.' }
  }

  const task = await getTask(profile.companyId, taskId)
  if (!task) return { error: 'Tarefa não encontrada.' }

  if (profile.role === 'technician') {
    const pId = profile.id.toLowerCase()
    const pAbbr = (profile.abbreviation || '').toLowerCase()
    const pName = (profile.name || '').toLowerCase()
    const isRG = profile.email?.toLowerCase().trim() === 'garrido.rui@gmail.com'

    const assignedIds = (task.assignedToIds || []).map((i) => i.toLowerCase())
    const assignedStr = (task.assignedTo || '').toLowerCase()

    const isAssigned =
      !task.assignedTo ||
      task.createdBy === profile.id ||
      task.assignedTo === profile.id ||
      task.assignedTo === profile.abbreviation ||
      assignedIds.includes(pId) ||
      (pAbbr && assignedIds.includes(pAbbr)) ||
      (pAbbr && assignedStr.includes(pAbbr)) ||
      (pName && assignedStr.includes(pName)) ||
      (pId && assignedStr.includes(pId)) ||
      isRG

    if (!isAssigned) return { error: 'Sem permissão para alterar o estado desta tarefa.' }
  }

  try {
    await updateTask(profile.companyId, taskId, { status: newStatus })
    if (newStatus === 'done') {
      await calculateTaskCost(profile.companyId, taskId)
    }
    revalidatePath('/dashboard/tasks')
    revalidatePath(`/dashboard/tasks/${taskId}`)
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard/maintenance-plan')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao atualizar estado.' }
  }
}
