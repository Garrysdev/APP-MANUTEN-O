'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { usePathname } from 'next/navigation'

type OfflineContextType = {
  isOnline: boolean
  pendingCount: number
  rejectedCount: number
  isSyncing: boolean
  syncNow: () => Promise<void>
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  pendingCount: 0,
  rejectedCount: 0,
  isSyncing: false,
  syncNow: async () => {},
})

export function useOffline() {
  return useContext(OfflineContext)
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [rejectedCount, setRejectedCount] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [syncedSuccessMsg, setSyncedSuccessMsg] = useState<boolean>(false)
  const pathname = usePathname()
  // Espelho local só faz sentido dentro da app autenticada (não em /login, /register, etc.)
  const withinDashboard = pathname?.startsWith('/dashboard')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)

      // Purga automática de cache do Service Worker a cada novo deploy.
      if ('caches' in window) {
        const CURRENT_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev'
        const lastVersion = localStorage.getItem('app_build_version')
        if (lastVersion !== CURRENT_VERSION) {
          localStorage.setItem('app_build_version', CURRENT_VERSION)
          caches.keys().then((keys) => {
            keys.forEach((key) => caches.delete(key))
          })
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
              for (const registration of registrations) {
                registration.unregister()
              }
            })
          }
          window.location.reload()
          return
        }
      }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.update()
          }
        })
      }

      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  // Sincronização real (RxDB) — só arranca dentro da app, e só uma vez.
  useEffect(() => {
    if (!withinDashboard || typeof window === 'undefined') return
    let cancelled = false
    let unsubTasks: (() => void) | undefined
    let unsubIv: (() => void) | undefined

    ;(async () => {
      const [{ startTechnicianReplication, resyncNow, getReplicationStates }, { getTechnicianDB }] = await Promise.all([
        import('@/lib/offline/replication'),
        import('@/lib/offline/rxdb'),
      ])
      await startTechnicianReplication()
      if (cancelled) return

      const db = await getTechnicianDB()
      const refreshCounts = async () => {
        const [tasks, ivs] = await Promise.all([
          db.tasks.find().exec(),
          db.interventions.find().exec(),
        ])
        const all = [...tasks, ...ivs]
        setPendingCount(all.filter((d) => (d as any)._localSyncState === 'pending').length)
        setRejectedCount(all.filter((d) => (d as any)._localSyncState === 'rejected').length)
      }
      await refreshCounts()
      const sub1 = db.tasks.$.subscribe(refreshCounts)
      const sub2 = db.interventions.$.subscribe(refreshCounts)
      unsubTasks = () => sub1.unsubscribe()
      unsubIv = () => sub2.unsubscribe()

      const states = getReplicationStates()
      states.forEach((s) => {
        s.active$.subscribe((active: boolean) => setIsSyncing(active))
      })

      const handleReconnect = () => { resyncNow().catch(() => {}) }
      window.addEventListener('online', handleReconnect)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') handleReconnect()
      })
    })().catch((err) => console.error('[OfflineProvider] Erro a iniciar sincronização:', err))

    return () => {
      cancelled = true
      unsubTasks?.()
      unsubIv?.()
    }
  }, [withinDashboard])

  async function syncNow() {
    if (!withinDashboard) return
    setIsSyncing(true)
    try {
      const { resyncNow } = await import('@/lib/offline/replication')
      await resyncNow()
      if (pendingCount === 0) {
        setSyncedSuccessMsg(true)
        setTimeout(() => setSyncedSuccessMsg(false), 3000)
      }
    } catch (err) {
      console.error('[OfflineProvider] Erro ao sincronizar:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, rejectedCount, isSyncing, syncNow }}>
      {children}

      {/* Barra Flutuante Discreta de Estado PWA Offline / Sincronização */}
      {(!isOnline || pendingCount > 0 || rejectedCount > 0 || isSyncing || syncedSuccessMsg) && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-1.5 transition-all">
          {!isOnline && (
            <div className="bg-amber-600 text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-amber-500 animate-pulse">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>Modo Offline — Alterações Guardadas Localmente</span>
            </div>
          )}

          {rejectedCount > 0 && (
            <div className="bg-red-700 text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{rejectedCount} alteração(ões) offline recusada(s) — revê a OT</span>
            </div>
          )}

          {isOnline && isSyncing && (
            <div className="bg-industrial-blue text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-blue-600">
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-safety-orange" />
              <span>A sincronizar com a nuvem…</span>
            </div>
          )}

          {isOnline && !isSyncing && pendingCount > 0 && (
            <button
              onClick={syncNow}
              className="bg-[#1B4F72] hover:bg-[#154360] text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-blue-400 transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 shrink-0 text-safety-orange" />
              <span>{pendingCount} alteração(ões) pendente(s) — Sincronizar Agora</span>
            </button>
          )}

          {syncedSuccessMsg && (
            <div className="bg-emerald-600 text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-emerald-500">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
              <span>Tudo sincronizado com sucesso!</span>
            </div>
          )}
        </div>
      )}
    </OfflineContext.Provider>
  )
}
