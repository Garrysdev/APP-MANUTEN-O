import { NextRequest, NextResponse } from 'next/server'
import { getCurrentProfile } from '@/lib/firebase/session'
import { listInternalMessages, syncInternalMessages } from '@/lib/firebase/data'
import type { InternalMessage } from '@/types/models'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getCurrentProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const roleStr = String(profile.role || '').toLowerCase().trim()
  const isManager =
    roleStr === 'manager' ||
    roleStr === 'admin' ||
    roleStr === 'gestor' ||
    roleStr === 'administrador' ||
    profile.email?.toLowerCase().trim() === 'garrido.rui@gmail.com'

  const msgs = await listInternalMessages(profile.companyId, isManager ? undefined : profile)
  return NextResponse.json({ messages: msgs })
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const msgs: InternalMessage[] = Array.isArray(body?.messages) ? body.messages : []
    const clean = msgs.filter((m) => m && m.id && !m.id.startsWith('msg_seed_'))
    if (clean.length > 0) {
      syncInternalMessages(clean)
    }
    return NextResponse.json({ ok: true, synced: clean.length })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao sincronizar' }, { status: 400 })
  }
}
