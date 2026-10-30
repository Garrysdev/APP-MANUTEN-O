import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { alignBianualPlansToStops } from '@/lib/firebase/data'

// Acerto único (30/10/2026): planos Bianuais com a próxima data fora das paragens passam
// para agosto/dezembro. POST ?dry=1 só lista o que mudaria. Só o gestor da própria empresa.
export async function POST(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 })
  if (profile.role !== 'manager') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const dryRun = new URL(req.url).searchParams.get('dry') === '1'
  try {
    const res = await alignBianualPlansToStops(profile.companyId, dryRun)
    if (!dryRun) {
      revalidatePath('/dashboard/maintenance-plan')
      revalidatePath('/dashboard/calendar')
      revalidatePath('/dashboard')
    }
    return NextResponse.json({ ok: true, dryRun, ...res })
  } catch (e) {
    console.error('alignBianualPlansToStops failed:', e)
    return NextResponse.json({ error: 'Erro ao acertar os planos Bianuais.' }, { status: 500 })
  }
}
