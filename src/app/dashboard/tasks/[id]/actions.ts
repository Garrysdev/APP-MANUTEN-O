'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import {
  createIntervention,
  deleteIntervention,
  updateTask,
  createMaterial,
  deleteMaterial,
  countInterventionsThisMonth,
  decrementStockQuantity,
  calculateTaskCost,
  getTask,
} from '@/lib/firebase/data'
import { LIMITS } from '@/lib/plans'
import type { ChecklistItem, TaskStatus, PlanName } from '@/types/models'
import { updateTaskStatusAction } from '../actions'

export type InterventionFormState = { error?: string; ok?: boolean }

export async function startTaskAction(taskId: string): Promise<InterventionFormState> {
  if (!taskId) return { error: 'Tarefa em falta.' }
  const result = await updateTaskStatusAction(taskId, 'in_progress')
  if (result.error) return { error: result.error }
  revalidatePath(`/dashboard/tasks/${taskId}`)
  return { ok: true }
}

import { sendOTClosureEmailNotification } from '@/lib/notifications'

export async function closeTaskAction(
  taskId: string,
  closureData?: {
    closureNotes?: string | null
    sendClosureEmail?: boolean
  }
): Promise<InterventionFormState> {
  if (!taskId) return { error: 'Tarefa em falta.' }
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

  const task = await getTask(profile.companyId, taskId)
  if (!task) return { error: 'Tarefa não encontrada.' }

  const updateData: any = {
    status: 'done',
    completedAt: new Date().toISOString(),
    closureNotes: closureData?.closureNotes || null,
    sendClosureEmail: Boolean(closureData?.sendClosureEmail),
  }

  await updateTask(profile.companyId, taskId, updateData)

  if (closureData?.sendClosureEmail && task.requesterEmail) {
    try {
      await sendOTClosureEmailNotification({
        toEmail: task.requesterEmail,
        taskTitle: task.title,
        taskId: task.id,
        tag: task.tag,
        area: task.area,
        closureNotes: closureData.closureNotes || task.description || 'Intervenção concluída.',
        closedByName: profile.name || 'Técnico de Manutenção',
      })
    } catch (err) {
      console.error('Erro ao enviar email de fecho de PI:', err)
    }
  }

  revalidatePath(`/dashboard/tasks/${taskId}`)
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/history')
  return { ok: true }
}

export async function reopenTaskAction(taskId: string): Promise<InterventionFormState> {
  if (!taskId) return { error: 'Tarefa em falta.' }
  const result = await updateTaskStatusAction(taskId, 'pending')
  if (result.error) return { error: result.error }
  revalidatePath(`/dashboard/tasks/${taskId}`)
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/history')
  return { ok: true }
}

export async function createInterventionAction(
  _prev: InterventionFormState,
  formData: FormData
): Promise<InterventionFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

  const taskId = String(formData.get('taskId') ?? '')
  if (!taskId) return { error: 'Tarefa em falta.' }

  // checklist vem como JSON do componente cliente
  let checklist: ChecklistItem[] = []
  try {
    const raw = String(formData.get('checklist') ?? '[]')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      checklist = parsed
        .filter((i) => i && typeof i.label === 'string' && i.label.trim())
        .map((i) => ({ label: String(i.label).trim(), done: Boolean(i.done) }))
    }
  } catch {
    checklist = []
  }

  const plan = (profile.company?.plan ?? 'free') as PlanName
  const monthCount = await countInterventionsThisMonth(profile.companyId)
  const { interventionsPerMonth } = LIMITS[plan]
  if (monthCount >= interventionsPerMonth) {
    return {
      error: `Limite de ${interventionsPerMonth} intervenção(ões) por mês atingido no plano ${plan}.`,
    }
  }

  const technicianId = String(formData.get('technicianId') ?? '').trim() || profile.id
  const startedAt = String(formData.get('startedAt') ?? '').trim() || null
  const endedAt = String(formData.get('endedAt') ?? '').trim() || null
  const observations = String(formData.get('observations') ?? '').trim() || null
  const newStatus = String(formData.get('taskStatus') ?? '').trim() as TaskStatus | ''

  let photoUrls: string[] | null = null
  try {
    const raw = String(formData.get('photoUrls') ?? '').trim()
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every((u) => typeof u === 'string')) {
        photoUrls = parsed.slice(0, 5)
      }
    }
  } catch { photoUrls = null }

  // materiais inline vêm como JSON do modal
  type InlineMaterial = {
    name: string
    reference?: string | null
    quantity: number
    unit?: string | null
    unitCost?: number | null
    stockItemId?: string | null
  }
  let inlineMaterials: InlineMaterial[] = []
  try {
    const raw = String(formData.get('inlineMaterials') ?? '').trim()
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) inlineMaterials = parsed
    }
  } catch { inlineMaterials = [] }

  try {
    const interventionId = await createIntervention(profile.companyId, {
      taskId,
      technicianId,
      startedAt,
      endedAt,
      observations,
      checklist,
      photoUrls,
    })

    // Cria materiais inline e desconta do stock quando aplicável
    if (inlineMaterials.length > 0) {
      await Promise.all(
        inlineMaterials.map(async (m) => {
          await createMaterial(profile.companyId, {
            interventionId,
            name: m.name,
            reference: m.reference ?? null,
            quantity: m.quantity,
            unit: m.unit ?? null,
            unitCost: m.unitCost ?? null,
          })
          if (m.stockItemId) {
            await decrementStockQuantity(profile.companyId, m.stockItemId, m.quantity)
          }
        })
      )
    }

    // Atualiza o estado da tarefa se foi pedido (ex.: marcar concluída)
    if (newStatus) {
      await updateTask(profile.companyId, taskId, { status: newStatus })
      if (newStatus === 'done') {
        await calculateTaskCost(profile.companyId, taskId)
      }
    } else {
      // Se apenas adicionou material/horas e já estava done, atualizamos na mesma
      const t = await getTask(profile.companyId, taskId)
      if (t?.status === 'done') await calculateTaskCost(profile.companyId, taskId)
    }

    revalidatePath(`/dashboard/tasks/${taskId}`)
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/history')
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/stocks')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao registar intervenção.' }
  }
}

export async function deleteInterventionAction(
  taskId: string,
  id: string
): Promise<InterventionFormState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  try {
    await deleteIntervention(profile.companyId, id)
    revalidatePath(`/dashboard/tasks/${taskId}`)
    revalidatePath('/dashboard/history')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao eliminar intervenção.' }
  }
}

// ── MATERIALS ─────────────────────────────────────────────────────────────────
export async function createMaterialAction(
  interventionId: string,
  taskId: string,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Nome obrigatório.' }

  const quantity = Number(formData.get('quantity') ?? 1)
  if (!quantity || quantity <= 0) return { error: 'Quantidade inválida.' }

  const unitCostRaw = Number(formData.get('unitCost') ?? '')
  const unitCost = unitCostRaw > 0 ? unitCostRaw : null

  try {
    await createMaterial(profile.companyId, {
      interventionId,
      name,
      reference: String(formData.get('reference') ?? '').trim() || null,
      quantity,
      unit: String(formData.get('unit') ?? '').trim() || null,
      unitCost,
    })
    revalidatePath(`/dashboard/tasks/${taskId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao adicionar material.' }
  }
}

export async function deleteMaterialAction(
  materialId: string,
  taskId: string
): Promise<{ error?: string; ok?: boolean }> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }
  try {
    await deleteMaterial(profile.companyId, materialId)
    revalidatePath(`/dashboard/tasks/${taskId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao eliminar material.' }
  }
}
