'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { getMaintenancePlan, createTask, updateMaintenancePlan, getTask, updateTask } from '@/lib/firebase/data'

export type CalendarActionState = { error?: string; ok?: boolean }

export async function rescheduleCalendarItemAction(
  type: 'task' | 'plan',
  id: string,
  targetDate: string,
  originalDate?: string
): Promise<CalendarActionState> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Sessão expirada.' }

  try {
    const isPlanItem = type === 'plan' || id.startsWith('plan_')
    const taskId = isPlanItem ? (id.startsWith('plan_') ? id : `plan_${id}`) : id
    const planId = isPlanItem ? taskId.replace('plan_', '') : null

    const task = await getTask(profile.companyId, taskId)
    let newPlannedStart = `${targetDate}T09:00`
    if (task && task.plannedStartDate) {
      const timePart = task.plannedStartDate.includes('T') ? task.plannedStartDate.split('T')[1] : '09:00'
      newPlannedStart = `${targetDate}T${timePart}`
    }

    await updateTask(profile.companyId, taskId, {
      dueDate: targetDate,
      plannedStartDate: newPlannedStart,
      ...(planId ? { maintenancePlanId: planId } : {}),
    })

    if (planId) {
      await updateMaintenancePlan(profile.companyId, planId, {
        calendarStartDate: targetDate,
        calendarDates: [targetDate],
        nextDueDate: targetDate,
      }).catch(() => null)
    }

    revalidatePath('/dashboard/calendar')
    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard/maintenance-plan')
    revalidatePath('/dashboard/projects')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erro ao reagendar agendamento no calendário.' }
  }
}

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
