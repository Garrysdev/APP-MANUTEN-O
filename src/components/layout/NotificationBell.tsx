import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, MessageSquare, ClipboardList, AlertTriangle, ExternalLink, X, Volume2, Smartphone } from 'lucide-react'
import type { AppNotification } from '@/types/models'
import { formatDateTime } from '@/lib/utils'
import { markNotificationReadAction, markAllNotificationsReadAction, getLatestNotificationsAction } from '@/app/dashboard/messages/actions'
import { playNotificationSound } from '@/lib/sound'

export default function NotificationBell({ initialNotifications = [] }: { initialNotifications?: AppNotification[] }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(initialNotifications.filter((n) => !n.read).length)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Tocar som se chegarem novas notificações não lidas
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      playNotificationSound()
    }
    prevCountRef.current = unreadCount
  }, [unreadCount])

  // Polling periódico em segundo plano para capturar novas mensagens / OTs atribuídas
  useEffect(() => {
    let isMounted = true
    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      try {
        const fresh = await getLatestNotificationsAction()
        if (isMounted && Array.isArray(fresh) && fresh.length >= 0) {
          setNotifications(fresh)
        }
      } catch {}
    }, 120000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // Atualizar de imediato quando a página de Mensagens marca mensagens como lidas,
  // em vez de esperar pelo polling periódico (até 2 minutos de atraso)
  useEffect(() => {
    async function handleRefresh() {
      try {
        const fresh = await getLatestNotificationsAction()
        if (Array.isArray(fresh)) setNotifications(fresh)
      } catch {}
    }
    window.addEventListener('rg:refresh-notifications', handleRefresh)
    return () => window.removeEventListener('rg:refresh-notifications', handleRefresh)
  }, [])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Solicitar permissão e registar subscrição Web Push no telemóvel/browser
  useEffect(() => {
    async function initPush() {
      if (typeof window === 'undefined') return
      if ('Notification' in window && 'serviceWorker' in navigator) {
        if (Notification.permission === 'granted') {
          try {
            const { subscribeToPushNotifications } = await import('@/lib/webpush-client')
            await subscribeToPushNotifications('auto').catch(() => {})
          } catch (e) {
            console.warn('[NotificationBell] Push sync warning:', e)
          }
        } else if (Notification.permission === 'default') {
          try {
            const perm = await Notification.requestPermission()
            if (perm === 'granted') {
              const { subscribeToPushNotifications } = await import('@/lib/webpush-client')
              await subscribeToPushNotifications('auto').catch(() => {})
            }
          } catch (e) {
            console.warn('[NotificationBell] Push permission error:', e)
          }
        }
      }
    }
    void initPush()
  }, [])

  async function handleEnablePush() {
    try {
      playNotificationSound()
      const { subscribeToPushNotifications } = await import('@/lib/webpush-client')
      const ok = await subscribeToPushNotifications('manual')
      if (ok) {
        alert('Notificações e sons no telemóvel ativados com sucesso!')
      }
    } catch (err: any) {
      alert(err?.message || 'Falha ao ativar notificações.')
    }
  }

  function handleTestSound() {
    playNotificationSound()
  }

  async function handleMarkRead(n: AppNotification) {
    if (!n.read) {
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)))
      await markNotificationReadAction(n.id)
    }
    setOpen(false)
    if (n.link) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rg:open-notification', { detail: { link: n.link, notification: n } }))
      }
      router.push(n.link)
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
    await markAllNotificationsReadAction()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-2 text-industrial-blue-light hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative cursor-pointer"
        title="Notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-600 text-white font-extrabold text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-16 sm:top-full mt-2 w-auto sm:w-96 max-w-sm sm:max-w-none bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden space-y-0">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-industrial-blue dark:text-sky-400" />
              <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                Notificações ({unreadCount} não lidas)
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-industrial-blue dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Sem notificações recentes
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkRead(n)}
                  className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex items-start gap-3 ${
                    !n.read ? 'bg-blue-50/50 dark:bg-blue-950/30' : ''
                  }`}
                >
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 text-industrial-blue dark:text-sky-400">
                    {n.type === 'internal_message' ? (
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <ClipboardList className="h-4 w-4 text-orange-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {n.title}
                      </h4>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                      {n.body}
                    </p>
                    <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                      {formatDateTime(n.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-1 text-center">
            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={handleTestSound}
                className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-industrial-blue dark:hover:text-sky-400 flex items-center gap-1 py-1 cursor-pointer"
              >
                <Volume2 className="h-3.5 w-3.5 text-safety-orange" />
                <span>Testar Som</span>
              </button>

              <button
                type="button"
                onClick={handleEnablePush}
                className="text-[11px] font-bold text-safety-orange hover:underline flex items-center gap-1 py-1 cursor-pointer"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Ativar no Telemóvel</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                router.push('/dashboard/messages')
              }}
              className="text-xs font-bold text-industrial-blue dark:text-sky-400 hover:underline flex items-center justify-center gap-1 w-full pt-1 border-t border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
            >
              <span>Ver todas as mensagens</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

