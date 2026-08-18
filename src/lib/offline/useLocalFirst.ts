'use client'

/**
 * RG Maintenance — Hook React Local-First (useLocalFirst)
 * Permite que a UI leia instantaneamente do IndexedDB local (< 10ms) e revalide assincronamente com a nuvem.
 */

import { useState, useEffect } from 'react'
import { localDB } from './db'
import { syncEngine, type SyncStatus } from './sync'

export function useLocalFirstList<T>(
  storeName: 'assets' | 'tasks' | 'interventions' | 'materials',
  companyId: string,
  initialData?: T[]
) {
  const [data, setData] = useState<T[]>(initialData || [])
  const [loading, setLoading] = useState<boolean>(!initialData || initialData.length === 0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    error: null,
  })

  // 1. Subscrever ao estado do Motor de Sincronização
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe(setSyncStatus)
    return () => unsubscribe()
  }, [])

  // 2. Carregamento Local Instantâneo (< 10ms) + Revalidação Cloud
  useEffect(() => {
    let isMounted = true

    async function loadLocalFirst() {
      try {
        // A. Leitura Instantânea do IndexedDB local
        const localItems = await localDB.getAll<T>(storeName, companyId)
        if (isMounted && localItems.length > 0) {
          setData(localItems)
          setLoading(false)
        }

        // B. Revalidação com a Nuvem em background
        if (companyId) {
          await syncEngine.syncDown(companyId)
          const updatedItems = await localDB.getAll<T>(storeName, companyId)
          if (isMounted && updatedItems.length > 0) {
            setData(updatedItems)
          }
        }
      } catch (err) {
        console.error(`[useLocalFirstList] Erro ao carregar ${storeName}:`, err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadLocalFirst()

    return () => {
      isMounted = false
    }
  }, [storeName, companyId])

  return {
    data,
    loading,
    syncStatus,
    refresh: () => companyId && syncEngine.syncDown(companyId),
  }
}
