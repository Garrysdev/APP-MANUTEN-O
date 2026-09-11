import { NextResponse } from 'next/server'
import { put, list, del } from '@vercel/blob'
import { adminDb } from '@/lib/firebase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Coleções com dados de negócio que não podem ser recriados se se perderem.
// Fica de fora o que é efémero/derivado: notifications, invites, system_sync,
// deleted_users, deleted_internal_messages.
const COLLECTIONS = [
  'companies',
  'users',
  'assets',
  'tasks',
  'maintenance_plans',
  'interventions',
  'materials',
  'stock_items',
  'stock_movements',
  'warehouses',
  'safety_rules',
  'external_companies',
  'internal_messages',
] as const

const RETENTION_DAYS = 30

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'object' && 'toDate' in (value as any) && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().toISOString()
  }
  if (Array.isArray(value)) return value.map(sanitize)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitize(v)
    return out
  }
  return value
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const db = adminDb()
    const dateStr = new Date().toISOString().slice(0, 10)

    const backup: Record<string, unknown[]> = {}
    const counts: Record<string, number> = {}

    for (const name of COLLECTIONS) {
      const snap = await db.collection(name).get()
      const docs = snap.docs.map((d) => sanitize({ id: d.id, ...d.data() }))
      backup[name] = docs as unknown[]
      counts[name] = docs.length
    }

    const payload = JSON.stringify({ generatedAt: new Date().toISOString(), counts, collections: backup })

    const blob = await put(`backups/${dateStr}.json`, payload, {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json',
      allowOverwrite: true,
    })

    // Retenção: apaga backups com mais de RETENTION_DAYS dias
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    const { blobs } = await list({ prefix: 'backups/' })
    const stale = blobs.filter((b) => new Date(b.uploadedAt).getTime() < cutoff)
    if (stale.length > 0) {
      await del(stale.map((b) => b.url))
    }

    return NextResponse.json({ ok: true, url: blob.url, counts, deletedOldBackups: stale.length })
  } catch (err) {
    console.error('[cron/backup] Erro ao gerar backup:', err)
    return NextResponse.json({ error: 'Erro ao gerar backup.' }, { status: 500 })
  }
}
