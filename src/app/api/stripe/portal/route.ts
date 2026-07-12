import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getCurrentProfile } from '@/lib/firebase/session'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(req: NextRequest) {
  void req
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (profile.role !== 'manager') return NextResponse.json({ error: 'Acesso restrito a gestores' }, { status: 403 })

  const db = adminDb()
  const companySnap = await db.collection('companies').doc(profile.companyId).get()
  const customerId = companySnap.data()?.stripeCustomerId as string | undefined

  if (!customerId) return NextResponse.json({ error: 'Sem subscrição activa' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard/billing`,
  })

  return NextResponse.json({ url: session.url })
}
