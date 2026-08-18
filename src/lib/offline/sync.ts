/**
 * RG Maintenance — Motor de Sincronização Assíncrono (Local-First Cloud Sync)
 * Gere o download em lote da fábrica para o IndexedDB e o envio de mutações offline para a nuvem.
 */

import { localDB, type SyncQueueItem } from './db'

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: string | null
  error: string | null
}

type SyncStatusListener = (status: SyncStatus) => void

class RGMaintenanceSyncEngine {
  private statusListeners: Set<SyncStatusListener> = new Set()
  private isSyncing = false
  private lastSyncAt: string | null = null
  private error: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncEngine] Conexão restaurada. A processar fila de sincronização...')
        this.processSyncQueue()
      })
      window.addEventListener('offline', () => {
        console.log('[SyncEngine] Conexão perdida. Modo 100% Offline ativado.')
        this.notifyStatus()
      })
    }
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.statusListeners.add(listener)
    this.notifyStatus()
    return () => this.statusListeners.delete(listener)
  }

  private async notifyStatus() {
    const queue = typeof window !== 'undefined' ? await localDB.getSyncQueue() : []
    const status: SyncStatus = {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: this.isSyncing,
      pendingCount: queue.length,
      lastSyncAt: this.lastSyncAt,
      error: this.error,
    }
    this.statusListeners.forEach((fn) => fn(status))
  }

  /**
   * Sync Down: Descarrega os dados atualizados da nuvem e armazena localmente em IndexedDB.
   */
  async syncDown(companyId: string) {
    if (typeof window === 'undefined' || !navigator.onLine) return

    try {
      this.isSyncing = true
      this.notifyStatus()

      // 1. Carregar Equipamentos
      const resAssets = await fetch(`/api/tasks?companyId=${companyId}&type=assets`)
      if (resAssets.ok) {
        const assets = await resAssets.json()
        if (Array.isArray(assets)) {
          await localDB.putBatch('assets', assets)
        }
      }

      // 2. Carregar Tarefas / Ordens de Trabalho
      const resTasks = await fetch(`/api/tasks?companyId=${companyId}`)
      if (resTasks.ok) {
        const tasks = await resTasks.json()
        if (Array.isArray(tasks)) {
          await localDB.putBatch('tasks', tasks)
        }
      }

      this.lastSyncAt = new Date().toISOString()
      this.error = null
    } catch (err: any) {
      console.error('[SyncEngine] Erro no Sync Down:', err)
      this.error = err.message || 'Falha ao sincronizar com a nuvem'
    } finally {
      this.isSyncing = false
      this.notifyStatus()
    }
  }

  /**
   * Sync Up: Envia a fila de mutações offline para os endpoints de API da nuvem.
   */
  async processSyncQueue() {
    if (typeof window === 'undefined' || !navigator.onLine || this.isSyncing) return

    const queue = await localDB.getSyncQueue()
    if (queue.length === 0) return

    this.isSyncing = true
    this.notifyStatus()

    for (const item of queue) {
      try {
        let success = false

        if (item.collection === 'tasks') {
          if (item.action === 'create') {
            const res = await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload),
            })
            success = res.ok
          } else if (item.action === 'update') {
            const res = await fetch(`/api/tasks/${item.payload.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload),
            })
            success = res.ok
          }
        }

        if (success) {
          await localDB.removeFromSyncQueue(item.id)
        } else {
          item.attempts += 1
          await localDB.put('syncQueue', item)
        }
      } catch (err) {
        console.error('[SyncEngine] Erro ao enviar item da fila:', item, err)
        break
      }
    }

    this.isSyncing = false
    this.lastSyncAt = new Date().toISOString()
    this.notifyStatus()
  }
}

export const syncEngine = new RGMaintenanceSyncEngine()
