import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { backfillOtNumbers } from '@/lib/firebase/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Numeração das OTs sem otNumber (ver backfillOtNumbers): primeiro as antigas, por lotes
// noturnos para não gastar a quota de uma vez (a UR tem ~6700 OTs → ~3 noites); depois,
// todas as noites, só as criadas sem número (consulta `otNumber == null`, barata).
const PER_RUN = 3000

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}
  try {
    const companies = await adminDb().collection('companies').get()
    for (const c of companies.docs) {
      try {
        results[c.id] = await backfillOtNumbers(c.id, PER_RUN)
      } catch (err) {
        console.error(`[cron/ot-numbers] ${c.id}:`, err)
        results[c.id] = { error: String((err as Error)?.message || err) }
      }
    }
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('[cron/ot-numbers] Erro:', err)
    return NextResponse.json({ error: 'Erro ao numerar OTs.', results }, { status: 500 })
  }
}
