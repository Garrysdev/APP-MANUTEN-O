import webpush from 'web-push'

let vapidConfigured = false

// Configuração lazy: só ocorre no primeiro envio, em runtime — nunca no import/build.
// Se faltarem as chaves VAPID, devolve false sem quebrar (o build não depende disto).
// As variáveis gravadas no Vercel a partir do PowerShell trazem um BOM (U+FEFF) no início —
// "﻿mailto:..." deixava de ser um URL válido e nenhum push era enviado.
const cleanEnv = (v?: string) => (v || '').replace(/^﻿/, '').trim()

function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = cleanEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  const privateKey = cleanEnv(process.env.VAPID_PRIVATE_KEY)
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(
    cleanEnv(process.env.VAPID_SUBJECT) || 'mailto:admin@rgmaintenance.pt',
    publicKey,
    privateKey
  )
  vapidConfigured = true
  return true
}

export async function sendWebPush(subscription: any, payload: { title: string; message: string; url?: string }) {
  if (!subscription || !subscription.endpoint) {
    console.warn('[WebPush] Subscrição inválida ou sem endpoint.')
    return false
  }
  if (!ensureVapid()) {
    console.warn('[WebPush] Não configurado: faltam as chaves VAPID no ambiente do servidor (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).')
    return false
  }

  try {
    const res = await webpush.sendNotification(subscription, JSON.stringify(payload))
    console.log(`[WebPush] Notificação push enviada com sucesso (status ${res.statusCode}) para ${subscription.endpoint.slice(0, 45)}...`)
    return true
  } catch (error: any) {
    if (error?.statusCode === 410 || error?.statusCode === 404) {
      console.warn(`[WebPush] Subscrição push expirada/revogada no browser cliente (status ${error.statusCode}).`)
    } else {
      console.error('[WebPush] Erro ao enviar notificação push:', error?.message || error)
    }
    return false
  }
}
