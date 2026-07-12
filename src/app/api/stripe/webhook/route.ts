import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase/admin'
import type { PlanName } from '@/types/models'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  const db = adminDb()

  // Idempotência: ignora eventos já processados (Stripe pode reenviar em falhas)
  const eventRef = db.collection('stripe_events').doc(event.id)
  try {
    await eventRef.create({
      type: event.type,
      processedAt: new Date().toISOString(),
      // TTL: Firestore pode limpar automaticamente após 90 dias se configurado
      ttl: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    })
  } catch (e: unknown) {
    const err = e as { code?: number; message?: string }
    if (err.code === 6 || String(err.message).includes('ALREADY_EXISTS')) {
      return NextResponse.json({ received: true })
    }
    throw e
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const subId = typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id
      const companyId = session.metadata?.companyId
      const plan = session.metadata?.plan as PlanName | undefined
      if (companyId && plan && subId) {
        await db.collection('companies').doc(companyId).update({
          plan,
          stripeSubscriptionId: subId,
        })
      }
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const companyId = sub.metadata?.companyId
      const plan = sub.metadata?.plan as PlanName | undefined
      if (companyId && plan) {
        const active = sub.status === 'active' || sub.status === 'trialing'
        await db.collection('companies').doc(companyId).update({
          plan: active ? plan : 'starter',
        })
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const companyId = sub.metadata?.companyId
      if (companyId) {
        await db.collection('companies').doc(companyId).update({
          plan: 'starter',
          stripeSubscriptionId: null,
        })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
