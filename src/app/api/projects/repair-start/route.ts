import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { repairProjectStartEqualsDue } from '@/lib/firebase/data'

// Acerto único (05/11/2026): Projetos por iniciar com o início igual à Data Limite (marco
// arrastado no Gantt). POST ?dry=1 só lista. Só o gestor da própria empresa.
export async function POST(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 })
  if (profile.role !== 'manager') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const dryRun = new URL(req.url).searchParams.get('dry') === '1'
  try {
    const res = await repairProjectStartEqualsDue(profile.companyId, dryRun)
    if (!dryRun) {
      revalidatePath('/dashboard/projects')
      revalidatePath('/dashboard/gantt')
      revalidatePath('/dashboard/tasks')
    }
    return NextResponse.json({ ok: true, dryRun, ...res })
  } catch (e) {
    console.error('repairProjectStartEqualsDue failed:', e)
    return NextResponse.json({ error: 'Erro ao acertar os Projetos.' }, { status: 500 })
  }
}
