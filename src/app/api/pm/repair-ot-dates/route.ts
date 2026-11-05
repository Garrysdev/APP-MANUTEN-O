import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/firebase/session'
import { repairPmOtsBeforeLastExecution } from '@/lib/firebase/data'

// Acerto único (05/11/2026): OT de PM abertas que ficaram com a data de uma execução já
// feita (gravar o técnico "para o futuro"). POST ?dry=1 só lista. Só o gestor da empresa.
export async function POST(req: Request) {
  const profile = await getCurrentProfile()
  if (!profile) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 })
  if (profile.role !== 'manager') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const dryRun = new URL(req.url).searchParams.get('dry') === '1'
  try {
    const res = await repairPmOtsBeforeLastExecution(profile.companyId, dryRun)
    if (!dryRun) {
      revalidatePath('/dashboard/maintenance-plan')
      revalidatePath('/dashboard/calendar')
      revalidatePath('/dashboard/tasks')
      revalidatePath('/dashboard')
    }
    return NextResponse.json({ ok: true, dryRun, ...res })
  } catch (e) {
    console.error('repairPmOtsBeforeLastExecution failed:', e)
    return NextResponse.json({ error: 'Erro ao acertar as OT de PM.' }, { status: 500 })
  }
}
