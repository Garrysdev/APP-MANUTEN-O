'use server'

import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listMaintenancePlans } from '@/lib/firebase/data'
import { isProjectTask, isTaskAssignedToUser } from '@/lib/task-assignment'
import { planCurrentDate } from '@/lib/pm-schedule'

export type SummaryItem = { id: string; title: string; tag: string | null; date: string | null; href: string }
export type StartupSummary = { tasks: SummaryItem[]; projects: SummaryItem[]; pm: SummaryItem[]; weekStart: string; weekEnd: string }

const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** Segunda a domingo da semana de hoje. */
function currentWeek(): { start: string; end: string; today: string } {
  const now = new Date()
  const monday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  return { start: ymd(monday), end: ymd(sunday), today: ymd(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))) }
}

/**
 * Resumo mostrado ao abrir a app (pedido do Rui, 03/11/2026): OT e Projetos em curso e as
 * OT de PM previstas para esta semana. Usa as listas já em cache (sem leituras extra na
 * maioria das aberturas); o técnico só vê o que lhe está atribuído.
 */
export async function getStartupSummaryAction(): Promise<StartupSummary | null> {
  const profile = await getCurrentProfile()
  if (!profile) return null
  try {
    const { start, end, today } = currentWeek()
    const [tasks, plans] = await Promise.all([listTasks(profile.companyId), listMaintenancePlans(profile.companyId)])
    const mine = profile.role === 'manager' ? () => true : (t: unknown) => isTaskAssignedToUser(t, profile)

    const inProgress = tasks.filter((t) => t.status === 'in_progress' && mine(t))
    const toItem = (t: (typeof tasks)[number], href: string): SummaryItem => ({
      id: t.id,
      title: t.title || '—',
      tag: t.tag || null,
      date: (t.startedAt || t.plannedStartDate || t.createdAt || '').slice(0, 10) || null,
      href,
    })

    const pm = plans
      .filter((p) => p.active !== false && (profile.role === 'manager' || p.assignedTo === profile.id))
      .map((p) => ({ p, date: planCurrentDate(p, today) }))
      .filter(({ date }) => date && date >= start && date <= end)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(({ p, date }) => ({ id: p.id, title: p.title, tag: p.tag || null, date, href: '/dashboard/maintenance-plan' }))

    return {
      tasks: inProgress.filter((t) => !isProjectTask(t)).map((t) => toItem(t, `/dashboard/tasks/${encodeURIComponent(t.id)}`)),
      projects: inProgress.filter(isProjectTask).map((t) => toItem(t, '/dashboard/projects')),
      pm,
      weekStart: start,
      weekEnd: end,
    }
  } catch (err) {
    console.error('[getStartupSummaryAction] Error:', err)
    return null
  }
}
