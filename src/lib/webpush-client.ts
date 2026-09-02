import { updatePushSubscriptionAction } from '@/app/dashboard/profile/actions'

// Converte a VAPID key para Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPushNotifications(_userId: string) {
  try {
    if (typeof window === 'undefined') return false

    if (!('Notification' in window)) {
      throw new Error('Notificações não são suportadas neste navegador.')
    }

    // Pedir permissão explicitamente no telemóvel/PC
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      throw new Error('Permissão de notificações recusada nas definições do navegador.')
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker não suportado neste navegador.')
    }

    // Registar ou aguardar Service Worker
    let registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js')
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey || vapidKey.length < 20) {
      throw new Error('Chave VAPID pública não configurada no ambiente (NEXT_PUBLIC_VAPID_PUBLIC_KEY).')
    }

    if (!('PushManager' in window) || !registration || !registration.pushManager) {
      throw new Error('O suporte a Notificações Push não está ativo neste browser. No iOS (iPhone), adiciona o RG Maintenance ao ecrã principal.')
    }

    // Obter ou criar subscrição real
    let sub = await registration.pushManager.getSubscription()
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }

    const subscriptionPayload = JSON.parse(JSON.stringify(sub))
    if (!subscriptionPayload?.endpoint) {
      throw new Error('Endpoint de notificação push não foi gerado pelo dispositivo.')
    }

    // Guardar subscrição real via Server Action
    const result = await updatePushSubscriptionAction(subscriptionPayload)
    if (result.error) {
      throw new Error(result.error)
    }

    return true
  } catch (err) {
    console.error('Falha ao subscrever push:', err)
    throw err
  }
}
