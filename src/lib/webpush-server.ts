import webpush from 'web-push'

let vapidConfigured = false

// Configuração lazy: só ocorre no primeiro envio, em runtime — nunca no import/build.
// Se faltarem as chaves VAPID, devolve false sem quebrar (o build não depende disto).
function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@rgmaintenance.pt',
    publicKey,
    privateKey
  )
  vapidConfigured = true
  return true
}

export async function sendWebPush(subscription: any, payload: { title: string; message: string; url?: string }) {
  if (!subscription) return false
  if (!ensureVapid()) {
    console.warn('Web push não configurado: faltam as chaves VAPID.')
    return false
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (error) {
    console.error('Falha ao enviar web push:', error)
    return false
  }
}
