import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret || secret !== process.env.ADMIN_DIAG_MANAGERS_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const snap = await adminDb().collection('users').get()
  const rows = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((u: any) => {
      const r = String(u.role || '').toLowerCase().trim()
      return r === 'manager' || r === 'admin' || r === 'gestor' || r === 'administrador'
    })
    .map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      companyId: u.companyId,
      isExternal: u.isExternal ?? null,
      active: u.active,
      createdAt: u.createdAt,
    }))

  return NextResponse.json({ count: rows.length, rows })
}
