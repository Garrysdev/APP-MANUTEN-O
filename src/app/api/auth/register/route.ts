// Registo: o cliente cria o utilizador no Firebase Auth e envia o idToken.
// Suporta dois modos:
//   1) Novo gestor: { idToken, companyName, userName } → cria empresa + gestor
//   2) Convite: { idToken, userName, inviteToken } → junta-se à empresa existente
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase/admin'
import {
  createCompanyWithManager,
  getInviteByToken,
  markInviteUsed,
  createUserFromInvite,
} from '@/lib/firebase/data'
import { SESSION_COOKIE } from '@/lib/firebase/session'

export const runtime = 'nodejs'

const FIVE_DAYS_MS = 60 * 60 * 24 * 5 * 1000

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hora
const RATE_MAX_REGISTER = 5

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_MAX_REGISTER
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Demasiados registos. Aguarda 1 hora.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { idToken, userName, companyName, inviteToken } = body

    if (!idToken || typeof idToken !== 'string' || idToken.length > 4096) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }
    if (!userName?.trim()) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    const decoded = await adminAuth().verifyIdToken(idToken)
    const uid = decoded.uid
    const email = decoded.email ?? ''

    if (inviteToken) {
      // Modo convite: juntar à empresa existente
      const invite = await getInviteByToken(String(inviteToken), email)
      if (!invite) {
        return NextResponse.json({ error: 'Convite inválido, expirado ou para outro e-mail.' }, { status: 400 })
      }
      await createUserFromInvite(uid, email, String(userName), invite.companyId, invite.role)
      await markInviteUsed(invite.id)
    } else {
      // Modo novo gestor: criar empresa
      if (!companyName?.trim()) {
        return NextResponse.json({ error: 'Nome de empresa obrigatório.' }, { status: 400 })
      }
      await createCompanyWithManager(uid, email, {
        companyName: String(companyName),
        userName: String(userName),
      })
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
  } catch (error) {
    console.error('Falha no registo:', error)
    return NextResponse.json({ error: 'Falha ao criar a conta.' }, { status: 400 })
  }
}
