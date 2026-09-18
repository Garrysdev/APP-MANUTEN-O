import type { MaintenancePlan, Task, TaskStatus } from '@/types/models'

/**
 * Encontra a OT ligada a um Plano de Manutenção num dado ano — por
 * maintenancePlanId (ou código do plano) ou, em fallback, por TAG + título
 * semelhante. Entre várias OTs correspondentes, prefere a que ainda está
 * aberta (Pendente/Em Curso); só cai na mais recente concluída se não
 * houver nenhuma em aberto. Espelha exatamente a lógica usada na tabela do
 * Plano de Manutenção (coluna TAREFA), para os dois lados mostrarem sempre
 * o mesmo número.
 */
export function findPlanLinkedTask(plan: MaintenancePlan, tasks: Task[], year: number): Task | null {
  const linkedTasks = tasks.filter((t) => {
    const matches =
      (t.maintenancePlanId && (t.maintenancePlanId === plan.id || t.maintenancePlanId === (plan as any).code)) ||
      (t.tag && plan.tag && t.tag.trim().toLowerCase() === plan.tag.trim().toLowerCase() && (() => {
        const tTitle = (t.title || '').trim().toLowerCase()
        const pTitle = (plan.title || '').trim().toLowerCase()
        const pAcao = (plan.description || '').trim().toLowerCase()
        return tTitle === pTitle || (pAcao && tTitle.includes(pAcao)) || (pTitle && tTitle.includes(pTitle))
      })())
    if (!matches) return false
    const d = t.dueDate || t.plannedStartDate || t.completedAt
    return d ? new Date(d).getFullYear() === year : false
  })
  if (linkedTasks.length === 0) return null
  const pending = linkedTasks
    .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
  const mostRecent = linkedTasks.slice().sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''))[0]
  return pending[0] || mostRecent
}

/** Estado exibido no botão dinâmico da coluna TAREFA (default: Pendente quando não há OT ligada). */
export function getPmOccurrenceStatus(plan: MaintenancePlan, tasks: Task[], year: number): TaskStatus {
  const linkedTask = findPlanLinkedTask(plan, tasks, year)
  const rawStatus = linkedTask?.status
  return (rawStatus === 'in_progress' || rawStatus === 'done') ? rawStatus : 'pending'
}
