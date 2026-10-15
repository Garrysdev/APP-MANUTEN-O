import 'server-only'
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-05-27.dahlia' as never,
})

export const STRIPE_PLAN_PRICES: Record<string, string | undefined> = {
  // 'free' = Módulo Base, deixou de ser grátis (ver src/lib/plans.ts) — price_... próprio.
  free: process.env.STRIPE_PRICE_BASE,
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS,
}
