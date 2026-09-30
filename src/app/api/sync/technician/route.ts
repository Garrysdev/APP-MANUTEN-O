import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listTasks, listAssetRefs, listSafetyRules, listInterventions, getTask } from '@/lib/firebase/data'
import { isTaskAssignedToUser } from '@/lib/task-assignment'
import {
  changeTaskStatus,
  updateTaskFRsAndITs,
  updateTaskExecutionDetails,
  createInterventionCore,
} from '@/lib/offline/technician-actions'
import type { Task, Intervention } from '@/types/models'

export const dynamic = 'force-dynamic'

/**
 * Sincronização offline do técnico — Fase 1 (ver plano aprovado
 * hashed-drifting-petal.md). RxDB nunca fala com o Firestore diretamente; fala só com
 * esta rota, que reutiliza as mesmas funções cacheadas/validadas já usadas pelas Server
 * Actions online (nunca lógica de autorização duplicada).
 *
 * GET  ?collection=tasks|interventions|assetRefs|safetyRules&checkpoint=&batchSize= → pull
 * POST { collection, rows } → push
 */

function toLocalTask(t: Task) {
  return {
    id: t.id,
    companyId: t.companyId,
    title: t.title,
    description: t.description ?? null,
    assetId: t.assetId ?? null,
    tag: (t as any).tag ?? null,
    area: (t as any).area ?? null,
    status: t.status,
    criticidade: t.criticidade,
    tipo: t.tipo,
    dueDate: t.dueDate ?? null,
    plannedStartDate: t.plannedStartDate ?? null,
    startedAt: t.startedAt ?? null,
    completedAt: t.completedAt ?? null,
    observacoes: (t as any).observacoes ?? null,
    assignedTo: t.assignedTo ?? null,
    assignedToIds: t.assignedToIds ?? [],
    requiredFRs: t.requiredFRs ?? [],
    requiredITs: t.requiredITs ?? [],
    completedFRs: (t as any).completedFRs ?? null,
    acknowledgedITs: (t as any).acknowledgedITs ?? [],
    safetyRules: t.safetyRules ?? [],
    updatedAt: t.updatedAt || t.createdAt,
    createdAt: t.createdAt,
    _localSyncState: null,
    _localSyncReason: null,
    _pendingOp: null,
    _deleted: false,
  }
}

function toLocalIntervention(iv: Intervention) {
  return {
    id: iv.id,
    companyId: iv.companyId,
    taskId: iv.taskId,
    technicianId: iv.technicianId ?? null,
    startedAt: iv.startedAt ?? null,
    endedAt: iv.endedAt ?? null,
    observations: iv.observations ?? null,
    checklist: iv.checklist ?? [],
    photoUrls: iv.photoUrls ?? null,
    updatedAt: (iv as any).updatedAt || iv.createdAt,
    createdAt: iv.createdAt,
    _localSyncState: null,
    _localSyncReason: null,
    _deleted: false,
  }
}

function paginateByUpdatedAt<T extends { updatedAt: string }>(
  items: T[],
  checkpoint: string | null,
  batchSize: number
) {
  const sorted = [...items].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  const filtered = checkpoint ? sorted.filter((d) => d.updatedAt > checkpoint) : sorted
  const page = filtered.slice(0, batchSize)
  const last = page[page.length - 1]
  return {
    documents: page,
    checkpoint: last ? { updatedAt: last.updatedAt } : (checkpoint ? { updatedAt: checkpoint } : undefined),
  }
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const collection = searchParams.get('collection')
  const checkpoint = searchParams.get('checkpoint')
  const batchSize = Math.min(Math.max(Number(searchParams.get('batchSize')) || 50, 1), 2000)

  try {
    if (collection === 'tasks') {
      const allTasks = await listTasks(profile.companyId)
      // Âmbito decidido sempre no servidor a partir da sessão — nunca aceitar um filtro
      // vindo do cliente (senão o espelho local de um técnico podia ser levado a
      // replicar a lista inteira da empresa).
      const mine = allTasks.filter((t) => isTaskAssignedToUser(t, profile)).map((t) => ({ ...toLocalTask(t) }))
      return NextResponse.json(paginateByUpdatedAt(mine, checkpoint, batchSize))
    }

    if (collection === 'interventions') {
      const allTasks = await listTasks(profile.companyId)
      const myTaskIds = new Set(allTasks.filter((t) => isTaskAssignedToUser(t, profile)).map((t) => t.id))
      const allInterventions = await listInterventions(profile.companyId)
      const mine = allInterventions
        .filter((iv) => myTaskIds.has(iv.taskId))
        .map((iv) => toLocalIntervention(iv))
      return NextResponse.json(paginateByUpdatedAt(mine, checkpoint, batchSize))
    }

    if (collection === 'assetRefs') {
      const refs = await listAssetRefs(profile.companyId)
      const documents = refs.map((a) => ({ id: a.id, companyId: profile.companyId, name: a.name, tag: a.tag ?? null, area: a.area ?? null }))
      return NextResponse.json({ documents, checkpoint: undefined })
    }

    if (collection === 'safetyRules') {
      const rules = await listSafetyRules(profile.companyId)
      const documents = rules.map((r: any) => ({ id: r.id, companyId: profile.companyId, title: r.title || r.name || r.rule || '', category: r.category ?? null }))
      return NextResponse.json({ documents, checkpoint: undefined })
    }

    return NextResponse.json({ error: 'Coleção desconhecida.' }, { status: 400 })
  } catch (e) {
    console.error('[GET /api/sync/technician]', e)
    return NextResponse.json({ error: 'Erro ao sincronizar.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 })

  let body: { collection?: string; rows?: any[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 })
  }
  const { collection, rows } = body
  if (!collection || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  try {
    if (collection === 'tasks') {
      const conflicts: any[] = []
      for (const row of rows) {
        const doc = row.newDocumentState
        const taskId = doc.id
        const expectedUpdatedAt = row.assumedMasterState?.updatedAt
        const op = doc._pendingOp
        let result: { ok: boolean; error?: string; conflict?: boolean } = { ok: true }

        if (op?.type === 'status') {
          result = await changeTaskStatus({
            companyId: profile.companyId, profile, taskId, newStatus: op.payload.newStatus, expectedUpdatedAt,
          })
        } else if (op?.type === 'frsIts') {
          result = await updateTaskFRsAndITs({ companyId: profile.companyId, taskId, data: op.payload, expectedUpdatedAt })
        } else if (op?.type === 'execDetails') {
          result = await updateTaskExecutionDetails({ companyId: profile.companyId, taskId, data: op.payload, expectedUpdatedAt })
        }
        // Sem _pendingOp reconhecido: não há nada seguro a fazer (nunca escrever o
        // documento completo em bruto) — tratado como aceite sem alteração no servidor,
        // a próxima leitura repõe o estado real.

        if (!result.ok) {
          const current = await getTask(profile.companyId, taskId)
          conflicts.push(current ? toLocalTask(current) : { ...doc, _deleted: true })
        }
      }
      return NextResponse.json(conflicts)
    }

    if (collection === 'interventions') {
      const conflicts: any[] = []
      for (const row of rows) {
        const doc = row.newDocumentState
        const result = await createInterventionCore({
          companyId: profile.companyId,
          profile,
          taskId: doc.taskId,
          clientId: doc.id,
          expectedUpdatedAt: row.assumedMasterState?.updatedAt,
          data: {
            technicianId: doc.technicianId,
            startedAt: doc.startedAt,
            endedAt: doc.endedAt,
            observations: doc.observations,
            checklist: doc.checklist,
            photoUrls: doc.photoUrls,
          },
        })
        if (!result.ok) conflicts.push({ ...doc, _localSyncState: 'rejected', _localSyncReason: result.error })
      }
      return NextResponse.json(conflicts)
    }

    return NextResponse.json({ error: 'Coleção sem escrita suportada.' }, { status: 400 })
  } catch (e) {
    console.error('[POST /api/sync/technician]', e)
    return NextResponse.json({ error: 'Erro ao enviar alterações.' }, { status: 500 })
  }
}
