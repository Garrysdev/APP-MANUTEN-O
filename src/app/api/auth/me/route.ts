import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/firebase/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// uid da sessão atual — usado pelo browser para abrir a base offline (RxDB) DESTE
// utilizador (ver lib/offline/rxdb.ts). Só verifica o cookie: não lê o Firestore.
export async function GET() {
  const session = await getSessionUser().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  return NextResponse.json({ uid: session.uid }, { headers: { 'Cache-Control': 'no-store' } })
}
