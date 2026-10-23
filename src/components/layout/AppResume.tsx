'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// Quando o telemóvel fecha a app em segundo plano (falta de memória), ao voltar ela
// arranca de novo no start_url (/dashboard). Guardamos a última página vista para a
// reabrir aí, como uma app normal. Só ao abrir a app instalada — nunca depois do login
// nem a meio da navegação.
export const LAST_PAGE_KEY = 'rgm_last_page'
const MAX_AGE_MS = 12 * 60 * 60 * 1000
// Página servida da cache do service worker (rede lenta): pede os dados frescos logo a seguir.
const STALE_AFTER_MS = 30_000

function isAppLaunch(): boolean {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return standalone && nav?.type === 'navigate' && !document.referrer
}

export default function AppResume({ renderedAt }: { renderedAt: number }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === '/dashboard' && isAppLaunch()) {
      try {
        const saved = JSON.parse(localStorage.getItem(LAST_PAGE_KEY) || 'null') as { path?: string; at?: number } | null
        const path = saved?.path
        if (path && path !== '/dashboard' && path.startsWith('/dashboard/') && Date.now() - (saved?.at ?? 0) < MAX_AGE_MS) {
          router.replace(path)
          return
        }
      } catch { /* sem localStorage */ }
    }
    if (navigator.onLine && Date.now() - renderedAt > STALE_AFTER_MS) router.refresh()
    // Só no arranque da app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!pathname?.startsWith('/dashboard')) return
    try {
      localStorage.setItem(LAST_PAGE_KEY, JSON.stringify({ path: pathname + window.location.search, at: Date.now() }))
    } catch { /* sem localStorage */ }
  }, [pathname])

  return null
}
