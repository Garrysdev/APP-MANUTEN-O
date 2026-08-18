/**
 * RG Maintenance — Motor Local-First (IndexedDB Client Database)
 * Base de dados nativa no navegador do cliente para funcionamento offline 100% resiliente e respostas instantâneas (< 10ms).
 */

export interface SyncQueueItem {
  id: string
  action: 'create' | 'update' | 'delete'
  collection: 'assets' | 'tasks' | 'interventions' | 'materials'
  payload: any
  timestamp: string
  attempts: number
}

const DB_NAME = 'RGMaintenanceLocalDB'
const DB_VERSION = 1

export class RGMaintenanceDB {
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('IndexedDB só está disponível no ambiente cliente.'))
    }
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase

        // Tabela de Equipamentos
        if (!db.objectStoreNames.contains('assets')) {
          const assetsStore = db.createObjectStore('assets', { keyPath: 'id' })
          assetsStore.createIndex('companyId', 'companyId', { unique: false })
          assetsStore.createIndex('tag', 'tag', { unique: false })
        }

        // Tabela de Ordens de Trabalho / Tarefas
        if (!db.objectStoreNames.contains('tasks')) {
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' })
          tasksStore.createIndex('companyId', 'companyId', { unique: false })
          tasksStore.createIndex('status', 'status', { unique: false })
          tasksStore.createIndex('assetId', 'assetId', { unique: false })
        }

        // Tabela de Intervenções
        if (!db.objectStoreNames.contains('interventions')) {
          const interventionsStore = db.createObjectStore('interventions', { keyPath: 'id' })
          interventionsStore.createIndex('companyId', 'companyId', { unique: false })
          interventionsStore.createIndex('taskId', 'taskId', { unique: false })
        }

        // Tabela de Materiais / Stock
        if (!db.objectStoreNames.contains('materials')) {
          const materialsStore = db.createObjectStore('materials', { keyPath: 'id' })
          materialsStore.createIndex('companyId', 'companyId', { unique: false })
        }

        // Fila de Sincronização (Sync Queue)
        if (!db.objectStoreNames.contains('syncQueue')) {
          const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
          queueStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }

      request.onsuccess = (event: any) => resolve(event.target.result)
      request.onerror = (event: any) => reject(event.target.error)
    })

    return this.dbPromise
  }

  // ── MÉTODOS GENÉRICOS DE CONSULTA LOCAL ──────────────────────────────────
  async getAll<T>(storeName: string, companyId?: string): Promise<T[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        let results = request.result as T[]
        if (companyId) {
          results = results.filter((item: any) => item.companyId === companyId)
        }
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getById<T>(storeName: string, id: string): Promise<T | null> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async put<T>(storeName: string, item: T): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.put(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async putBatch<T>(storeName: string, items: T[]): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      items.forEach((item) => store.put(item))

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async delete(storeName: string, id: string): Promise<void> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // ── FILA DE SINCRONIZAÇÃO (OFFLINE ACTION QUEUE) ─────────────────────────
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'attempts'>): Promise<string> {
    const queueItem: SyncQueueItem = {
      ...item,
      id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      attempts: 0,
    }
    await this.put('syncQueue', queueItem)
    return queueItem.id
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const items = await this.getAll<SyncQueueItem>('syncQueue')
    return items.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    await this.delete('syncQueue', id)
  }
}

export const localDB = new RGMaintenanceDB()

export type PendingMutation = SyncQueueItem

export async function getPendingMutations(): Promise<PendingMutation[]> {
  if (typeof window === 'undefined') return []
  return localDB.getSyncQueue()
}

export async function removePendingMutation(id: string): Promise<void> {
  if (typeof window === 'undefined') return
  return localDB.removeFromSyncQueue(id)
}
