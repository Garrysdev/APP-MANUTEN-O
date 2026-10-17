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

// Backup COMPLETO ao domingo (ou se não houver nenhum completo nos últimos 7 dias, ou
// com ?full=1); nos outros dias só INCREMENTAL — os documentos com createdAt/updatedAt
// desde o último backup (com 1h de margem). O completo diário lia todas as coleções de
// todas as empresas (~12 mil leituras/dia, cerca de 1/4 da quota grátis) para guardar
// ~10 alterações. O incremental grava em `backups/AAAA-MM-DD.incremental.json`.
//
// Restaurar: partir do último completo (`backups/AAAA-MM-DD.json`) e aplicar por ordem
// os incrementais seguintes (upsert por id). Limitações do incremental, apanhadas no
// completo seguinte: não regista eliminações, nem edições que não atualizem
// updatedAt (ex.: updateAsset, calculateTaskCost/totalCost), nem documentos com datas
// gravadas como Timestamp.
const FULL_BACKUP_MAX_AGE_DAYS = 7

// Coleções pequenas copiadas sempre por inteiro, mesmo nos dias incrementais: várias
// escritas nelas não atualizam updatedAt (desativar utilizador, valor/hora, plano Stripe,
// nome/logótipo/créditos da empresa...) e um restauro traria de volta o estado antigo.
const ALWAYS_FULL = new Set<string>(['companies', 'users', 'warehouses', 'safety_rules', 'external_companies'])
const INCREMENTAL_OVERLAP_MS = 60 * 60 * 1000

type BlobInfo = { pathname: string; uploadedAt: Date }

function planBackup(blobs: BlobInfo[], now: Date, forceFull: boolean): { type: 'full' | 'incremental'; since: string | null } {
  const fullCutoff = now.getTime() - FULL_BACKUP_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  const hasRecentFull = blobs.some(
    (b) => !b.pathname.includes('.incremental.') && new Date(b.uploadedAt).getTime() >= fullCutoff
  )
  const lastBackupAt = Math.max(0, ...blobs.map((b) => new Date(b.uploadedAt).getTime()))
  if (forceFull || now.getUTCDay() === 0 || !hasRecentFull || lastBackupAt === 0) {
    return { type: 'full', since: null }
  }
  return { type: 'incremental', since: new Date(lastBackupAt - INCREMENTAL_OVERLAP_MS).toISOString() }
}

type Db = ReturnType<typeof adminDb>

async function readFull(db: Db, name: string): Promise<unknown[]> {
  const snap = await db.collection(name).get()
  return snap.docs.map((d) => sanitize({ id: d.id, ...d.data() }))
}

// Duas queries de um só campo (sem índice composto): criados OU alterados desde `since`.
// Se alguma falhar, cai para a leitura completa dessa coleção — nunca um backup parcial.
async function readChangedSince(db: Db, name: string, since: string): Promise<unknown[]> {
  try {
    const [updated, created] = await Promise.all([
      db.collection(name).where('updatedAt', '>=', since).get(),
      db.collection(name).where('createdAt', '>=', since).get(),
    ])
    const byId = new Map<string, unknown>()
    for (const d of [...updated.docs, ...created.docs]) {
      byId.set(d.id, sanitize({ id: d.id, ...d.data() }))
    }
    return Array.from(byId.values())
  } catch (err) {
    console.warn(`[cron/backup] Incremental falhou em ${name}, a ler a coleção completa:`, err)
    return readFull(db, name)
  }
}

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
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)

    const { blobs } = await list({ prefix: 'backups/' })
    const plan = planBackup(blobs, now, new URL(request.url).searchParams.get('full') === '1')

    const backup: Record<string, unknown[]> = {}
    const counts: Record<string, number> = {}

    for (const name of COLLECTIONS) {
      const docs = plan.type === 'full' || ALWAYS_FULL.has(name)
        ? await readFull(db, name)
        : await readChangedSince(db, name, plan.since!)
      backup[name] = docs
      counts[name] = docs.length
    }

    const payload = JSON.stringify({
      type: plan.type,
      since: plan.since,
      generatedAt: now.toISOString(),
      counts,
      collections: backup,
    })

    const pathname = plan.type === 'full' ? `backups/${dateStr}.json` : `backups/${dateStr}.incremental.json`
    const blob = await put(pathname, payload, {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json',
      allowOverwrite: true,
    })

    // Retenção: apaga backups com mais de RETENTION_DAYS dias
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    const stale = blobs.filter((b) => new Date(b.uploadedAt).getTime() < cutoff)
    if (stale.length > 0) {
      await del(stale.map((b) => b.url))
    }

    return NextResponse.json({ ok: true, type: plan.type, since: plan.since, url: blob.url, counts, deletedOldBackups: stale.length })
  } catch (err) {
    console.error('[cron/backup] Erro ao gerar backup:', err)
    return NextResponse.json({ error: 'Erro ao gerar backup.' }, { status: 500 })
  }
}
