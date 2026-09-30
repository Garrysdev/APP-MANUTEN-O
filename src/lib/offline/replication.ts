'use client'

/**
 * Sincronização do técnico — Fase 1. Fala só com /api/sync/technician (nunca com o
 * Firestore diretamente do browser — ver o "porquê" no plano aprovado). `tasks` e
 * `interventions` replicam a sério (pull+push); `assetRefs`/`safetyRules` são só dados de
 * referência (o técnico nunca os edita), por isso usam um pull simples em vez de
 * replicação bidirecional.
 */

import { replicateRxCollection, type RxReplicationState } from 'rxdb/plugins/replication'
import { getTechnicianDB, type LocalTask, type LocalIntervention, type LocalAssetRef, type LocalSafetyRule } from './rxdb'

type Checkpoint = { updatedAt: string } | undefined

async function pullPage<T>(collection: string, checkpoint: Checkpoint, batchSize: number) {
  const params = new URLSearchParams({ collection, batchSize: String(batchSize) })
  if (checkpoint?.updatedAt) params.set('checkpoint', checkpoint.updatedAt)
  const res = await fetch(`/api/sync/technician?${params.toString()}`, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`Falha ao sincronizar (${collection}): HTTP ${res.status}`)
  return (await res.json()) as { checkpoint: Checkpoint; documents: (T & { _deleted: boolean })[] }
}

async function pushRows<T>(collection: string, rows: any[]) {
  const res = await fetch('/api/sync/technician', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection, rows }),
  })
  if (!res.ok) throw new Error(`Falha ao enviar alterações (${collection}): HTTP ${res.status}`)
  return (await res.json()) as (T & { _deleted: boolean })[]
}

let replicationStates: RxReplicationState<any, any>[] = []
let started = false

export async function startTechnicianReplication() {
  if (started) return
  started = true

  const db = await getTechnicianDB()

  const tasksRepl = replicateRxCollection<LocalTask, Checkpoint>({
    replicationIdentifier: 'technician-tasks-v1',
    collection: db.tasks,
    live: true,
    retryTime: 10000,
    autoStart: true,
    pull: {
      batchSize: 50,
      handler: async (lastCheckpoint, batchSize) => {
        const page = await pullPage<LocalTask>('tasks', lastCheckpoint, batchSize)
        return page
      },
    },
    push: {
      batchSize: 20,
      handler: async (rows) => pushRows<LocalTask>('tasks', rows),
    },
  })

  const interventionsRepl = replicateRxCollection<LocalIntervention, Checkpoint>({
    replicationIdentifier: 'technician-interventions-v1',
    collection: db.interventions,
    live: true,
    retryTime: 10000,
    autoStart: true,
    pull: {
      batchSize: 50,
      handler: async (lastCheckpoint, batchSize) => {
        const page = await pullPage<LocalIntervention>('interventions', lastCheckpoint, batchSize)
        return page
      },
    },
    push: {
      batchSize: 10,
      handler: async (rows) => pushRows<LocalIntervention>('interventions', rows),
    },
  })

  replicationStates = [tasksRepl, interventionsRepl]

  tasksRepl.error$.subscribe((err) => console.error('[Sync] tasks:', err))
  interventionsRepl.error$.subscribe((err) => console.error('[Sync] interventions:', err))

  await refreshReferenceData().catch((err) => console.error('[Sync] dados de referência:', err))
}

/** Pull simples (sem push) para equipamentos/regras de segurança — o técnico nunca os edita. */
export async function refreshReferenceData() {
  const db = await getTechnicianDB()
  const [assetsRes, rulesRes] = await Promise.all([
    fetch('/api/sync/technician?collection=assetRefs&batchSize=2000', { credentials: 'same-origin' }),
    fetch('/api/sync/technician?collection=safetyRules&batchSize=2000', { credentials: 'same-origin' }),
  ])
  if (assetsRes.ok) {
    const { documents } = (await assetsRes.json()) as { documents: LocalAssetRef[] }
    if (documents.length) await db.assetRefs.bulkUpsert(documents)
  }
  if (rulesRes.ok) {
    const { documents } = (await rulesRes.json()) as { documents: LocalSafetyRule[] }
    if (documents.length) await db.safetyRules.bulkUpsert(documents)
  }
}

/** Força uma sincronização imediata (ao reconectar / voltar a app a primeiro plano). */
export async function resyncNow() {
  await Promise.all(replicationStates.map((r) => r.reSync()))
  await refreshReferenceData().catch((err) => console.error('[Sync] dados de referência:', err))
}

export function getReplicationStates() {
  return replicationStates
}
