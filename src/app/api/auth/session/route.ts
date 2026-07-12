import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase/admin'
import { SESSION_COOKIE } from '@/lib/firebase/session'

export const runtime = 'nodejs'

const FIVE_DAYS_MS = 60 * 60 * 24 * 5 * 1000

// Simple in-process rate limiter: max 10 attempts per IP per 15 min
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_MAX = 10

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_MAX
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Demasiadas tentativas. Aguarda 15 minutos.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const idToken = typeof body?.idToken === 'string' ? body.idToken : null
    if (!idToken || idToken.length > 4096) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: FIVE_DAYS_MS,
    })

    const store = await cookies()
    store.set(SESSION_COOKIE, sessionCookie, {
      maxAge: FIVE_DAYS_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Falha na autenticação' }, { status: 401 })
  }
}

export async function DELETE() {
  const store = await cookies()
  const cookie = store.get(SESSION_COOKIE)?.value
  if (cookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(cookie, false)
      await adminAuth().revokeRefreshTokens(decoded.uid)
    } catch {
      // Session already invalid — just delete cookie
    }
  }
  store.delete(SESSION_COOKIE)
  return NextResponse.json({ ok: true })
}
