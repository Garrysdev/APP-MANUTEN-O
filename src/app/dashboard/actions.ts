'use server'

import { getCurrentProfile } from '@/lib/firebase/session'
import { getTasksForYearStats } from '@/lib/firebase/data'
import type { Task } from '@/types/models'

/** Busca as tarefas de um único ano (query pequena, cacheável) para os cartões de KPI
 * do Dashboard e das Estatísticas — nunca o histórico completo de uma só vez. */
export async function getYearTasksAction(year: number): Promise<Task[]> {
  const profile = await getCurrentProfile()
  if (!profile) return []
  return getTasksForYearStats(profile.companyId, year)
}
