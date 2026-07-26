import { getFirestore, doc, updateDoc } from 'firebase/firestore'
import { getFirebaseApp } from './firebase/client'

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

export async function subscribeToPushNotifications(userId: string) {
  try {
    if (typeof window === 'undefined') return false

    if (!('Notification' in window)) {
      throw new Error('Notificações não são suportadas neste navegador telemóvel/dispositivo.')
    }

    // Pedir permissão explicitamente no telemóvel
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      throw new Error('Permissão de notificações recusada no dispositivo. Ativa as notificações nas definições do telemóvel.')
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker não suportado neste navegador.')
    }

    // Registar ou aguardar Service Worker
    let registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js')
    }

    // Em telemóveis, a VAPID key padrão se não estiver presente no env
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa45x-b99D6489-09'

    let subscription = null
    if ('PushManager' in window && registration && registration.pushManager) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })
      } catch (pushErr) {
        console.warn('PushManager.subscribe falhou, guardando permissão local:', pushErr)
      }
    }

    // Guardar token no Firestore do utilizador
    const db = getFirestore(getFirebaseApp())
    await updateDoc(doc(db, 'users', userId), {
      pushSubscription: subscription
        ? JSON.parse(JSON.stringify(subscription))
        : { granted: true, updatedAt: new Date().toISOString() },
    })

    return true
  } catch (err) {
    console.error('Falha ao subscrever push:', err)
    throw err
  }
}
