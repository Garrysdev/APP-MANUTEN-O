'use client'

/**
 * Ponte entre as Server Actions normais (caminho online, comportamento inalterado) e o
 * espelho local RxDB (caminho offline, Fase 1) para os 4 pontos de mutação de técnico em
 * âmbito. Nunca decide "estou offline" só por `navigator.onLine` — esse valor reflete a
 * placa de rede, não se há de facto ligação ao servidor (ex.: wifi local sem uplink real
 * apareceria como "online"); tenta sempre a Server Action primeiro, com um limite de
 * tempo curto, e só cai para o caminho local se isso falhar/demorar.
 */

import { useCallback } from 'react'
import { getTechnicianDB, type LocalTask } from '@/lib/offline/rxdb'
import type { TaskStatus } from '@/types/models'

const ONLINE_ATTEMPT_TIMEOUT_MS = 6000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) }
    )
  })
}

export type OfflineActionResult = { ok: boolean; offline: boolean; error?: string }

async function tryOnlineFirst<T extends { error?: string; ok?: boolean }>(
  onlineAction: () => Promise<T>
): Promise<{ error?: string } | 'offline'> {
  try {
    const result = await withTimeout(onlineAction(), ONLINE_ATTEMPT_TIMEOUT_MS)
    if (result.error) return { error: result.error }
    return {}
  } catch {
    return 'offline'
  }
}

export function useOfflineAction() {
  const changeStatus = useCallback(async (
    taskId: string,
    newStatus: TaskStatus,
    onlineAction: () => Promise<{ error?: string; ok?: boolean }>
  ): Promise<OfflineActionResult> => {
    const attempt = await tryOnlineFirst(onlineAction)
    if (attempt !== 'offline') return { ok: !attempt.error, offline: false, error: attempt.error }

    const db = await getTechnicianDB()
    const doc = await db.tasks.findOne(taskId).exec()
    if (!doc) return { ok: false, offline: true, error: 'Esta OT ainda não foi descarregada para uso offline.' }
    await doc.incrementalPatch({
      status: newStatus,
      updatedAt: new Date().toISOString(),
      _localSyncState: 'pending',
      _localSyncReason: null,
      _pendingOp: { type: 'status', payload: { newStatus } },
    })
    return { ok: true, offline: true }
  }, [])

  const updateFRsAndITs = useCallback(async (
    taskId: string,
    data: { completedFRs?: Record<string, any> | null; acknowledgedITs?: string[] | null },
    onlineAction: () => Promise<{ error?: string; ok?: boolean }>
  ): Promise<OfflineActionResult> => {
    const attempt = await tryOnlineFirst(onlineAction)
    if (attempt !== 'offline') return { ok: !attempt.error, offline: false, error: attempt.error }

    const db = await getTechnicianDB()
    const doc = await db.tasks.findOne(taskId).exec()
    if (!doc) return { ok: false, offline: true, error: 'Esta OT ainda não foi descarregada para uso offline.' }
    const patch: Partial<LocalTask> = { updatedAt: new Date().toISOString(), _localSyncState: 'pending', _localSyncReason: null }
    if (data.completedFRs !== undefined) patch.completedFRs = data.completedFRs ?? null
    if (data.acknowledgedITs !== undefined) patch.acknowledgedITs = data.acknowledgedITs ?? []
    await doc.incrementalPatch({ ...patch, _pendingOp: { type: 'frsIts', payload: data } } as any)
    return { ok: true, offline: true }
  }, [])

  const updateExecutionDetails = useCallback(async (
    taskId: string,
    data: { observacoes?: string; photoUrl?: string; safetyRulesChecked?: string[]; frsChecked?: string[] },
    onlineAction: () => Promise<{ error?: string; ok?: boolean }>
  ): Promise<OfflineActionResult> => {
    const attempt = await tryOnlineFirst(onlineAction)
    if (attempt !== 'offline') return { ok: !attempt.error, offline: false, error: attempt.error }

    const db = await getTechnicianDB()
    const doc = await db.tasks.findOne(taskId).exec()
    if (!doc) return { ok: false, offline: true, error: 'Esta OT ainda não foi descarregada para uso offline.' }
    const patch: Partial<LocalTask> = { updatedAt: new Date().toISOString(), _localSyncState: 'pending', _localSyncReason: null }
    if (data.observacoes !== undefined) patch.observacoes = data.observacoes
    await doc.incrementalPatch({ ...patch, _pendingOp: { type: 'execDetails', payload: data } } as any)
    return { ok: true, offline: true }
  }, [])

  /** Sem fotos nem materiais inline offline (Fase 1) — ver plano aprovado. */
  const createIntervention = useCallback(async (
    taskId: string,
    data: {
      technicianId?: string | null
      startedAt?: string | null
      endedAt?: string | null
      observations?: string | null
      checklist?: { label: string; done: boolean }[]
    },
    onlineAction: () => Promise<{ error?: string; ok?: boolean }>
  ): Promise<OfflineActionResult> => {
    const attempt = await tryOnlineFirst(onlineAction)
    if (attempt !== 'offline') return { ok: !attempt.error, offline: false, error: attempt.error }

    const db = await getTechnicianDB()
    const task = await db.tasks.findOne(taskId).exec()
    if (!task) return { ok: false, offline: true, error: 'Esta OT ainda não foi descarregada para uso offline.' }
    const now = new Date().toISOString()
    await db.interventions.insert({
      id: crypto.randomUUID(),
      companyId: task.companyId,
      taskId,
      technicianId: data.technicianId ?? null,
      startedAt: data.startedAt ?? null,
      endedAt: data.endedAt ?? null,
      observations: data.observations ?? null,
      checklist: data.checklist ?? [],
      photoUrls: null,
      updatedAt: now,
      createdAt: now,
      _localSyncState: 'pending',
      _localSyncReason: null,
    })
    return { ok: true, offline: true }
  }, [])

  return { changeStatus, updateFRsAndITs, updateExecutionDetails, createIntervention }
}
