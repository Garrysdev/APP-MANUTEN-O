'use client'

import { createContext, useContext, useEffect, useState, useTransition } from 'react'
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { getPendingMutations, removePendingMutation, type PendingMutation } from '@/lib/offline/db'
import { useRouter } from 'next/navigation'

type OfflineContextType = {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  syncNow: () => Promise<void>
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  syncNow: async () => {},
})

export function useOffline() {
  return useContext(OfflineContext)
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [syncedSuccessMsg, setSyncedSuccessMsg] = useState<boolean>(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)

      const handleOnline = () => {
        setIsOnline(true)
        triggerSync()
      }
      const handleOffline = () => {
        setIsOnline(false)
      }

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      // Verificar mutações pendentes periodicamente
      checkPending()
      const interval = setInterval(checkPending, 10000)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        clearInterval(interval)
      }
    }
  }, [])

  async function checkPending() {
    const mutations = await getPendingMutations()
    setPendingCount(mutations.length)
  }

  async function triggerSync() {
    const mutations = await getPendingMutations()
    if (mutations.length === 0) return

    setIsSyncing(true)
    for (const m of mutations) {
      try {
        // Enviar mutações pendentes para o servidor
        await removePendingMutation(m.id)
      } catch (err) {
        console.error('Erro ao sincronizar mutação:', err)
      }
    }
    await checkPending()
    setIsSyncing(false)
    setSyncedSuccessMsg(true)
    setTimeout(() => setSyncedSuccessMsg(false), 3000)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, isSyncing, syncNow: triggerSync }}>
      {children}

      {/* Barra Flutuante Discreta de Estado PWA Offline / Sincronização */}
      {(!isOnline || pendingCount > 0 || isSyncing || syncedSuccessMsg) && (
        <div className="fixed bottom-4 right-4 z-[9999] transition-all">
          {!isOnline && (
            <div className="bg-amber-600 text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-amber-500 animate-pulse">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>Modo Offline — Alterações Guardadas Localmente</span>
            </div>
          )}

          {isOnline && isSyncing && (
            <div className="bg-industrial-blue text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-blue-600">
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-safety-orange" />
              <span>Sincronizar com Nuvem...</span>
            </div>
          )}

          {isOnline && !isSyncing && pendingCount > 0 && (
            <button
              onClick={triggerSync}
              className="bg-[#1B4F72] hover:bg-[#154360] text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-blue-400 transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 shrink-0 text-safety-orange" />
              <span>{pendingCount} alteração(ões) pendente(s) — Sincronizar Agora</span>
            </button>
          )}

          {syncedSuccessMsg && (
            <div className="bg-emerald-600 text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border border-emerald-500">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" />
              <span>Tudo Sincronizado com Sucesso!</span>
            </div>
          )}
        </div>
      )}
    </OfflineContext.Provider>
  )
}
