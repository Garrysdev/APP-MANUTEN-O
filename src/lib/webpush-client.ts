import { getFirestore, doc, updateDoc } from 'firebase/firestore'
import { getFirebaseApp } from './firebase/client'

// Converte a VAPID key para Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPushNotifications(userId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Web Push não é suportado neste browser.')
    }

    const registration = await navigator.serviceWorker.ready

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) throw new Error('VAPID Public Key não está configurada no .env.local')

    // Subscreve ao Push Server do Browser
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    // Guarda a subscrição no perfil do utilizador (Firestore)
    const db = getFirestore(getFirebaseApp())
    await updateDoc(doc(db, 'users', userId), {
      pushSubscription: JSON.parse(JSON.stringify(subscription)),
    })

    return true
  } catch (err) {
    console.error('Falha ao subscrever push:', err)
    throw err
  }
}
