'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// Listas que se atualizam sozinhas quando se volta à app/separador. Os dados vêm das
// listas materializadas (cache por empresa): sem alterações custa 0 leituras, depois de
// uma alteração 1–2. Só as listas — nunca páginas de detalhe/formulários.
const LIST_PATHS = new Set([
  '/dashboard/tasks',
  '/dashboard/assets',
  '/dashboard/maintenance-plan',
  '/dashboard/projects',
])

// No máximo uma atualização por minuto (trocar de separador várias vezes seguidas).
const MIN_INTERVAL_MS = 60_000

export default function RefreshOnFocus() {
  const router = useRouter()
  const pathname = usePathname()
  const lastRefresh = useRef(Date.now())

  useEffect(() => {
    if (!LIST_PATHS.has(pathname)) return

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!navigator.onLine) return
      if (Date.now() - lastRefresh.current < MIN_INTERVAL_MS) return
      lastRefresh.current = Date.now()
      router.refresh()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [pathname, router])

  return null
}
