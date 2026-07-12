import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@rgmaintenance.pt',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
  process.env.VAPID_PRIVATE_KEY as string
)

export async function sendWebPush(subscription: any, payload: { title: string; message: string; url?: string }) {
  if (!subscription) return false

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (error) {
    console.error('Falha ao enviar web push:', error)
    return false
  }
}
