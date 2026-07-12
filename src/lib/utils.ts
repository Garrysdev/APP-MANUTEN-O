import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '—'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h === 0) return `${m}min`
  return `${h}h ${m}min`
}

/**
 * Estado de atraso de uma tarefa por prazo (dueDate) vs hoje.
 * - verde:    dentro do planeado (ainda não venceu) ou sem prazo
 * - laranja:  vencida há até 1 semana (≤ 7 dias)
 * - vermelho: vencida há mais de 1 semana (> 7 dias)
 * Tarefas concluídas/canceladas não são avaliadas (devolve 'none').
 */
export type DelayLevel = 'verde' | 'laranja' | 'vermelho' | 'none'

export function taskDelayLevel(
  dueDate: string | null | undefined,
  status?: string | null,
): DelayLevel {
  if (status === 'done' || status === 'cancelled') return 'none'
  if (!dueDate) return 'verde'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prazo = new Date(dueDate)
  prazo.setHours(0, 0, 0, 0)
  const diasAtraso = Math.floor((hoje.getTime() - prazo.getTime()) / 86400000)
  if (diasAtraso <= 0) return 'verde'
  if (diasAtraso <= 7) return 'laranja'
  return 'vermelho'
}

export const DELAY_CLASSES: Record<DelayLevel, string> = {
  verde: 'text-green-700 bg-green-50 border border-green-200',
  laranja: 'text-orange-700 bg-orange-50 border border-orange-200',
  vermelho: 'text-red-700 bg-red-50 border border-red-200',
  none: 'text-gray-500',
}

export const DELAY_LABELS: Record<DelayLevel, string> = {
  verde: 'No prazo',
  laranja: 'Em atraso (≤1 semana)',
  vermelho: 'Atraso crítico (>1 semana)',
  none: '',
}
