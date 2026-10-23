import type { TaskStatus } from '@/types/models'

/**
 * Estado da OT derivado das datas reais de Início/Fim (nos dois sentidos), igual no
 * formulário e no servidor:
 *  - Fim preenchido            → Concluída
 *  - só Início preenchido      → Em Curso
 *  - nenhum dos dois           → Pendente (se estava Em Curso/Concluída)
 * "Cancelada" nunca é alterada; "Prazo" só muda quando há datas.
 */
export function deriveTaskStatus(status: TaskStatus, startedAt?: string | null, completedAt?: string | null): TaskStatus {
  if (status === 'cancelled') return status
  if (completedAt && completedAt.trim()) return 'done'
  if (startedAt && startedAt.trim()) return 'in_progress'
  if (status === 'done' || status === 'in_progress') return 'pending'
  return status
}
