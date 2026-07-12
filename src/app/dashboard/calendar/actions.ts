'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getMaintenancePlan, createTask, updateMaintenancePlan } from '@/lib/firebase/data'

export type CalendarActionState = { error?: string; ok?: boolean }

export async function createTaskFromPlanAction(
  _prev: CalendarActionState,
  formData: FormData
): Promise<CalendarActionState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }
  if (profile.role !== 'manager') return { error: 'Sem permissão.' }

  const planId = String(formData.get('planId') ?? '').trim()
  if (!planId) return { error: 'Plano em falta.' }

  const plan = await getMaintenancePlan(profile.companyId, planId)
  if (!plan) return { error: 'Plano não encontrado.' }

  const dueDate = String(formData.get('dueDate') ?? '').trim() || null
  const assignedTo = String(formData.get('assignedTo') ?? '').trim() || plan.assignedTo || null

  try {
    const now = new Date().toISOString()
    await createTask(profile.companyId, profile.id, {
      title: plan.title,
      description: plan.description,
      assetId: plan.assetId,
      assignedTo,
      criticidade: plan.criticidade,
      tipo: plan.tipo,
      status: 'pending',
      dueDate,
      safetyRules: plan.safetyRules,
      maintenancePlanId: planId,
    })

    await updateMaintenancePlan(profile.companyId, planId, { lastGeneratedAt: now })

    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao criar tarefa.' }
  }
}
