import { NextRequest, NextResponse } from 'next/server'
import { stripe, STRIPE_PLAN_PRICES } from '@/lib/stripe'
import { getCurrentProfile } from '@/lib/firebase/session'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (profile.role !== 'manager') return NextResponse.json({ error: 'Acesso restrito a gestores' }, { status: 403 })

  const { plan } = await req.json() as { plan: string }
  const priceId = STRIPE_PLAN_PRICES[plan]
  if (!priceId) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

  const db = adminDb()
  const companySnap = await db.collection('companies').doc(profile.companyId).get()
  if (!companySnap.exists) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
  const company = companySnap.data()!

  let customerId: string = company.stripeCustomerId ?? ''
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      name: company.name,
      metadata: { companyId: profile.companyId },
    })
    customerId = customer.id
    await companySnap.ref.update({ stripeCustomerId: customerId })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url: `${appUrl}/dashboard/billing?cancelled=1`,
    metadata: { companyId: profile.companyId, plan },
    subscription_data: {
      metadata: { companyId: profile.companyId, plan },
    },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
