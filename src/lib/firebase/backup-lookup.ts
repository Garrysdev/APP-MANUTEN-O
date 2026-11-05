import 'server-only'
import { list, get } from '@vercel/blob'

// Procura um documento nas cópias de segurança diárias (api/cron/backup → Vercel Blob,
// backups/AAAA-MM-DD[.incremental].json, privadas). Usado para recuperar registos apagados
// antes de 05/11/2026, cujo marcador de eliminado substituiu os dados no Firestore.

const MAX_FILES = 12

type BackupPayload = { collections?: Record<string, Record<string, unknown>[]> }

async function readBackup(pathname: string): Promise<BackupPayload | null> {
  const res = await get(pathname, { access: 'private' })
  if (!res || res.statusCode !== 200 || !res.stream) return null
  const text = await new Response(res.stream).text()
  return JSON.parse(text) as BackupPayload
}

/**
 * Versão mais recente (ainda não apagada) do documento `id` da coleção, desta empresa.
 * Percorre as cópias da mais nova para a mais antiga; null se não estiver em nenhuma.
 */
export async function findInBackups(
  collection: string,
  id: string,
  companyId: string
): Promise<Record<string, unknown> | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Cópias de segurança indisponíveis neste ambiente.')
  const { blobs } = await list({ prefix: 'backups/' })
  const newestFirst = [...blobs]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, MAX_FILES)
  for (const b of newestFirst) {
    let payload: BackupPayload | null = null
    try {
      payload = await readBackup(b.pathname)
    } catch (err) {
      console.error(`[backup-lookup] Falha a ler ${b.pathname}:`, err)
      continue
    }
    const doc = payload?.collections?.[collection]?.find(
      (d) => d.id === id && d.companyId === companyId && !d.deleted && Boolean(d.title)
    )
    if (doc) return doc
  }
  return null
}
