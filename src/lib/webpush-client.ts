import { updatePushSubscriptionAction } from '@/app/dashboard/profile/actions'

// Converte a VAPID key para Uint8Array de forma robusta e compatível com todos os browsers (sem falhas de Latin1 no atob)
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  // Remover aspas, espaços e quebras de linha que possam vir de variáveis de ambiente
  const clean = String(base64String || '').replace(/^["'\s]+|["'\s]+$/g, '').trim()
  const padding = '='.repeat((4 - (clean.length % 4)) % 4)
  const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/')

  // Decodificação direta e segura via bitwise (sem dependência estrita de atob)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const buffer: number[] = []
  let bufferLength = 0
  let bits = 0

  for (let i = 0; i < base64.length; i++) {
    const c = base64[i]
    if (c === '=') break
    const idx = chars.indexOf(c)
    if (idx === -1) continue
    bits = (bits << 6) | idx
    bufferLength += 6
    if (bufferLength >= 8) {
      bufferLength -= 8
      buffer.push((bits >> bufferLength) & 0xff)
    }
  }

  if (buffer.length > 0) {
    const arrayBuffer = new ArrayBuffer(buffer.length)
    const uint8 = new Uint8Array(arrayBuffer)
    for (let i = 0; i < buffer.length; i++) {
      uint8[i] = buffer[i]
    }
    return uint8
  }

  // Fallback padrão se bitwise não capturar nada
  try {
    const rawData = window.atob(base64)
    const arrayBuffer = new ArrayBuffer(rawData.length)
    const outputArray = new Uint8Array(arrayBuffer)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  } catch {
    return new Uint8Array(new ArrayBuffer(0))
  }
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
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
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
