// Arquivo de FR/IT preenchidas (auditorias): um registo por FR preenchida e por IT
// confirmada em cada OT. Os dados vêm das próprias OTs (completedFRs / acknowledgedITs) —
// não há uma coleção à parte que pudesse ficar desalinhada da OT.
import type { Task } from '@/types/models'
import { IT_ACKS_KEY, frSignature, itSignature } from '@/lib/doc-signatures'

export type DocRecord = {
  kind: 'FR' | 'IT'
  docId: string
  taskId: string
  otNumber: number | null
  taskTitle: string
  area: string | null
  tag: string | null
  /** Data do registo: assinatura, senão gravação, senão fim/criação da OT. */
  date: string | null
  signedBy: string | null
}

type TaskLike = Pick<Task, 'id' | 'title' | 'area' | 'tag' | 'createdAt' | 'completedAt' | 'completedFRs' | 'acknowledgedITs' | 'otNumber'>

export function docRecordsFromTasks(tasks: TaskLike[]): DocRecord[] {
  const out: DocRecord[] = []
  for (const t of tasks) {
    const base = {
      taskId: t.id,
      otNumber: typeof t.otNumber === 'number' ? t.otNumber : null,
      taskTitle: t.title || '',
      area: t.area ?? null,
      tag: t.tag ?? null,
    }
    const fallbackDate = t.completedAt || t.createdAt || null
    for (const [docId, entry] of Object.entries(t.completedFRs || {})) {
      if (docId === IT_ACKS_KEY || !entry || typeof entry !== 'object') continue
      const sig = frSignature(entry)
      const savedAt = (entry as Record<string, unknown>)._savedAt
      out.push({ ...base, kind: 'FR', docId, date: sig?.at || (typeof savedAt === 'string' ? savedAt : null) || fallbackDate, signedBy: sig?.name ?? null })
    }
    for (const docId of t.acknowledgedITs || []) {
      const sig = itSignature(t.completedFRs, docId)
      out.push({ ...base, kind: 'IT', docId, date: sig?.at || fallbackDate, signedBy: sig?.byName ?? null })
    }
  }
  return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}
