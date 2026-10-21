// Listas materializadas: cópia de uma coleção de uma empresa (OTs, equipamentos, planos)
// guardada em poucos documentos ("fatias") da coleção `materialized`, na mesma base de dados.
//
// Porquê: o Firestore cobra 1 leitura por documento devolvido. Ler a lista de OTs da UR
// custava ~2000-6700 leituras, e cada edição de UMA OT invalidava a cache e obrigava a
// reler tudo. Aqui:
//  - ler a lista = 1 leitura (índice) + só as fatias que mudaram desde a última leitura
//    nesta instância (cada fatia tem várias centenas de documentos e conta como 1 leitura);
//  - cada escrita atualiza só o item alterado na sua fatia (patch/touch), numa transação.
// A lista é reconstruída a partir da coleção real (N leituras) só quando não existe, está
// marcada como desatualizada (`stale`), ou tem mais de MAX_AGE_MS — rede de segurança para
// escritas feitas fora da app (scripts de importação, consola do Firebase).
//
// Reconstrução segura:
//  - cada reconstrução grava fatias NOVAS (com o seu buildId no nome) e só no fim troca o
//    índice, numa transação — quem estiver a ler continua a ver a versão anterior inteira;
//  - todas as escritas incrementam `writeSeq` no índice (também quando ainda não há cópia
//    utilizável); se mudou durante a reconstrução, ela não é publicada e repete-se, para
//    nunca publicar uma cópia sem uma escrita feita entretanto.
import 'server-only'
import { FieldPath, FieldValue } from 'firebase-admin/firestore'
import type { Firestore, Transaction } from 'firebase-admin/firestore'

export type MaterializedCollection = 'tasks' | 'assets' | 'maintenance_plans'
export type MaterializedItem = { id: string } & Record<string, any>

const META_COLLECTION = 'materialized'
const SCHEMA = 2
// Cada item é guardado como texto JSON (um campo por item): um mapa aninhado contaria cada
// subcampo para os limites do Firestore (20 000 campos e 40 000 entradas de índice por doc).
const TARGET_SHARD_BYTES = 300_000
const MAX_SHARD_BYTES = 800_000 // o limite do Firestore é 1 MiB por documento
const MAX_SHARDS = 256
const MAX_AGE_MS = 7 * 24 * 3600 * 1000
const REBUILD_ATTEMPTS = 2

type Meta = {
  schema: number
  buildId: string
  shards: number
  revs: Record<string, number>
  bytes: Record<string, number>
  builtAt: string
  stale?: boolean
  writeSeq?: number
}

type Memo = { buildId: string; revs: Record<number, number>; shards: Map<number, Map<string, MaterializedItem>> }

const memo = new Map<string, Memo>()
const inflight = new Map<string, Promise<MaterializedItem[]>>()

const memoKey = (coll: MaterializedCollection, companyId: string) => `${coll}|${companyId}`
const metaRef = (db: Firestore, coll: MaterializedCollection, companyId: string) =>
  db.collection(META_COLLECTION).doc(`${coll}__${companyId}`)
const shardRef = (db: Firestore, coll: MaterializedCollection, companyId: string, buildId: string, i: number) =>
  db.collection(META_COLLECTION).doc(`${coll}__${companyId}__${buildId}__${i}`)

const byteSize = (s: string) => Buffer.byteLength(s, 'utf8')

/** Fatia de um id (FNV-1a): estável, não depende da ordem nem do conteúdo. */
export function shardOf(id: string, shards: number): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % shards
}

function isUsable(meta: Meta | null): meta is Meta {
  if (!meta || meta.schema !== SCHEMA || meta.stale || !meta.buildId || !(meta.shards >= 1)) return false
  const age = Date.now() - Date.parse(meta.builtAt || '')
  return Number.isFinite(age) && age < MAX_AGE_MS
}

// Cópias profundas: quem recebe a lista pode alterá-la sem estragar a memória da instância.
function flatten(m: Memo): MaterializedItem[] {
  const out: MaterializedItem[] = []
  for (const shard of m.shards.values()) for (const item of shard.values()) out.push(structuredClone(item))
  return out
}

function parseShard(items: Record<string, string> | undefined): Map<string, MaterializedItem> {
  const map = new Map<string, MaterializedItem>()
  for (const [id, json] of Object.entries(items || {})) {
    try {
      map.set(id, { ...JSON.parse(json), id })
    } catch { /* item corrompido: fica de fora até à próxima reconstrução */ }
  }
  return map
}

async function deleteShards(db: Firestore, coll: MaterializedCollection, companyId: string, buildId: string | undefined, count: number) {
  if (!buildId || !(count > 0)) return
  for (let i = 0; i < count; i += 400) {
    const batch = db.batch()
    for (let j = i; j < Math.min(i + 400, count); j++) batch.delete(shardRef(db, coll, companyId, buildId, j))
    await batch.commit().catch(() => {})
  }
}

/** Reconstrói a lista a partir da coleção real (N leituras + 1 escrita por fatia). */
async function rebuild(db: Firestore, coll: MaterializedCollection, companyId: string): Promise<MaterializedItem[]> {
  const ref = metaRef(db, coll, companyId)
  let items: MaterializedItem[] = []
  for (let attempt = 0; attempt < REBUILD_ATTEMPTS; attempt++) {
    const before = await ref.get()
    const old = before.exists ? (before.data() as Partial<Meta>) : {}
    const seq0 = Number(old.writeSeq) || 0

    const snap = await db.collection(coll).where('companyId', '==', companyId).get()
    console.info(`[fs-reads] materialized rebuild ${coll}/${companyId}: ${snap.size} documentos`)
    const entries = snap.docs.map((d) => {
      const json = JSON.stringify(d.data())
      return { id: d.id, json, size: byteSize(d.id) + byteSize(json) }
    })
    const totalBytes = entries.reduce((s, e) => s + e.size, 0)

    let shards = Math.max(1, Math.ceil(totalBytes / TARGET_SHARD_BYTES))
    let groups: typeof entries[] = []
    for (;;) {
      groups = Array.from({ length: shards }, () => [])
      for (const e of entries) groups[shardOf(e.id, shards)].push(e)
      const biggest = Math.max(...groups.map((g) => g.reduce((s, e) => s + e.size, 0)))
      if (biggest <= MAX_SHARD_BYTES || shards >= MAX_SHARDS) break
      shards *= 2
    }

    const buildId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const revs: Record<string, number> = {}
    const bytes: Record<string, number> = {}
    const memoShards = new Map<number, Map<string, MaterializedItem>>()
    items = []
    groups.forEach((g, i) => {
      revs[i] = 0
      bytes[i] = g.reduce((s, e) => s + e.size, 0)
      const map = new Map<string, MaterializedItem>()
      for (const e of g) {
        const item = { ...JSON.parse(e.json), id: e.id }
        map.set(e.id, item)
        items.push(structuredClone(item))
      }
      memoShards.set(i, map)
    })

    try {
      // Fatias novas (nomes novos): a versão publicada continua intacta até à troca.
      for (let i = 0; i < shards; i += 10) {
        const batch = db.batch()
        for (let j = i; j < Math.min(i + 10, shards); j++) {
          batch.set(shardRef(db, coll, companyId, buildId, j), {
            companyId,
            collection: coll,
            items: Object.fromEntries(groups[j].map((e) => [e.id, e.json])),
          })
        }
        await batch.commit()
      }
      const published = await db.runTransaction(async (tx) => {
        const cur = await tx.get(ref)
        const c = cur.exists ? (cur.data() as Partial<Meta>) : {}
        // Houve escritas (ou outra reconstrução) desde a leitura acima: esta cópia pode
        // não as ter — não publicar.
        if ((Number(c.writeSeq) || 0) !== seq0 || (c.buildId || null) !== (old.buildId || null)) return false
        tx.set(ref, {
          schema: SCHEMA, buildId, shards, revs, bytes, companyId, collection: coll,
          count: entries.length, builtAt: new Date().toISOString(), stale: false, writeSeq: seq0,
        })
        return true
      })
      if (published) {
        memo.set(memoKey(coll, companyId), { buildId, revs: { ...revs }, shards: memoShards })
        await deleteShards(db, coll, companyId, old.buildId, Number(old.shards) || 0)
        return items
      }
      await deleteShards(db, coll, companyId, buildId, shards)
    } catch (err) {
      // A lista devolvida continua certa (veio da coleção real); a cópia publicada fica
      // marcada para ser reconstruída na próxima leitura.
      console.error(`[materialized] Falha a gravar ${coll}/${companyId}:`, err)
      await deleteShards(db, coll, companyId, buildId, shards)
      await ref.set({ stale: true }, { merge: true }).catch(() => {})
      return items
    }
  }
  // Escritas constantes durante as tentativas: devolve a leitura real sem publicar.
  return items
}

async function readOnce(db: Firestore, coll: MaterializedCollection, companyId: string, retried = false): Promise<MaterializedItem[]> {
  const key = memoKey(coll, companyId)
  let metaSnap
  try {
    metaSnap = await metaRef(db, coll, companyId).get()
  } catch (err) {
    // Firestore em baixo/quota: a última cópia desta instância é desta empresa e é
    // mais fiel do que qualquer reserva.
    const last = memo.get(key)
    if (last) return flatten(last)
    throw err
  }
  const meta = metaSnap.exists ? (metaSnap.data() as Meta) : null
  if (!isUsable(meta)) return rebuild(db, coll, companyId)

  const prev = memo.get(key)
  const m: Memo = prev && prev.buildId === meta.buildId
    ? { buildId: prev.buildId, revs: { ...prev.revs }, shards: new Map(prev.shards) }
    : { buildId: meta.buildId, revs: {}, shards: new Map() }
  const changed: number[] = []
  for (let i = 0; i < meta.shards; i++) {
    if (!m.shards.has(i) || m.revs[i] !== (meta.revs?.[i] ?? 0)) changed.push(i)
  }
  if (changed.length > 0) {
    const snaps = await db.getAll(...changed.map((i) => shardRef(db, coll, companyId, meta.buildId, i)))
    for (let k = 0; k < changed.length; k++) {
      // Fatia já apagada: o índice foi trocado por uma reconstrução entretanto — reler.
      if (!snaps[k].exists) return retried ? rebuild(db, coll, companyId) : readOnce(db, coll, companyId, true)
      m.shards.set(changed[k], parseShard(snaps[k].data()?.items))
      // Rev do índice lido ANTES da fatia: se a fatia já for mais recente, a próxima
      // leitura relê-a uma vez a mais — nunca fica com conteúdo mais antigo do que o rev.
      m.revs[changed[k]] = meta.revs?.[changed[k]] ?? 0
    }
  }
  memo.set(key, m)
  return flatten(m)
}

/**
 * Todos os documentos da coleção desta empresa (os mesmos que
 * `collection(coll).where('companyId','==',companyId).get()` devolveria, incluindo os
 * marcadores `deleted`). Pedidos simultâneos na mesma instância partilham a leitura.
 */
export function readMaterialized(db: Firestore, coll: MaterializedCollection, companyId: string): Promise<MaterializedItem[]> {
  const key = memoKey(coll, companyId)
  const running = inflight.get(key)
  if (running) return running.then((items) => items.map((i) => structuredClone(i)))
  const p = readOnce(db, coll, companyId).finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

/** Reconstrução forçada (ex. antes de numerar as OTs, se a contagem real não bater certo). */
export function rebuildMaterialized(db: Firestore, coll: MaterializedCollection, companyId: string): Promise<MaterializedItem[]> {
  return rebuild(db, coll, companyId)
}

type Entry = { id: string; data: Record<string, any> | null }

/** Aplica os itens às fatias, dentro de uma transação que já leu o índice (e tudo o resto). */
function applyEntries(
  tx: Transaction,
  db: Firestore,
  coll: MaterializedCollection,
  companyId: string,
  meta: Meta,
  entries: Entry[]
): { overflow: boolean; byShard: Map<number, Entry[]> } {
  const byShard = new Map<number, Entry[]>()
  for (const e of entries) {
    const i = shardOf(e.id, meta.shards)
    byShard.set(i, [...(byShard.get(i) || []), e])
  }
  const metaUpdates: unknown[] = [new FieldPath('writeSeq'), FieldValue.increment(1)]
  const shardWrites: [number, unknown[]][] = []
  for (const [i, list] of byShard) {
    const added = list.reduce((s, e) => s + byteSize(e.id) + (e.data ? byteSize(JSON.stringify(e.data)) : 0), 0)
    // Estimativa por excesso (soma o tamanho novo sem descontar o antigo): ao passar o
    // limite, a lista é reconstruída com mais fatias em vez de arriscar o limite de 1 MiB.
    if ((Number(meta.bytes?.[i]) || 0) + added > MAX_SHARD_BYTES) return { overflow: true, byShard }
    const fields: unknown[] = []
    for (const e of list) {
      fields.push(new FieldPath('items', e.id), e.data ? JSON.stringify(e.data) : FieldValue.delete())
    }
    shardWrites.push([i, fields])
    metaUpdates.push(new FieldPath('revs', String(i)), FieldValue.increment(1))
    metaUpdates.push(new FieldPath('bytes', String(i)), FieldValue.increment(added))
  }
  for (const [i, fields] of shardWrites) {
    const [first, firstValue, ...rest] = fields
    tx.update(shardRef(db, coll, companyId, meta.buildId, i), first as FieldPath, firstValue, ...rest)
  }
  const [first, firstValue, ...rest] = metaUpdates
  tx.update(metaRef(db, coll, companyId), first as FieldPath, firstValue, ...rest)
  return { overflow: false, byShard }
}

async function writeEntries(
  db: Firestore,
  coll: MaterializedCollection,
  companyId: string,
  getEntries: (tx: Transaction, meta: Meta) => Promise<Entry[]>
): Promise<void> {
  const ref = metaRef(db, coll, companyId)
  try {
    const result = await db.runTransaction(async (tx) => {
      const metaSnap = await tx.get(ref)
      const meta = metaSnap.exists ? (metaSnap.data() as Meta) : null
      if (!isUsable(meta)) {
        // Ainda sem cópia (ou a reconstruir): só regista que houve uma escrita, para uma
        // reconstrução em curso não publicar uma cópia sem ela.
        tx.set(ref, { writeSeq: FieldValue.increment(1) }, { merge: true })
        return null
      }
      const entries = await getEntries(tx, meta)
      if (entries.length === 0) return null
      const applied = applyEntries(tx, db, coll, companyId, meta, entries)
      if (applied.overflow) {
        tx.update(ref, { stale: true, writeSeq: FieldValue.increment(1) })
        return null
      }
      return { meta, byShard: applied.byShard }
    })
    if (!result) return
    // Esta instância passa a ter a fatia nova sem a reler (rev antigo + 1 = rev gravado).
    const m = memo.get(memoKey(coll, companyId))
    if (m && m.buildId === result.meta.buildId) {
      for (const [i, list] of result.byShard) {
        const oldRev = result.meta.revs?.[i] ?? 0
        const shard = m.shards.get(i)
        if (!shard || m.revs[i] !== oldRev) continue
        const next = new Map(shard)
        for (const e of list) {
          if (e.data) next.set(e.id, { ...structuredClone(e.data), id: e.id })
          else next.delete(e.id)
        }
        m.shards.set(i, next)
        m.revs[i] = oldRev + 1
      }
    }
  } catch (err) {
    console.error(`[materialized] Falha a atualizar ${coll}/${companyId}:`, err)
    await ref.set({ stale: true, writeSeq: FieldValue.increment(1) }, { merge: true }).catch(() => {})
  }
}

/**
 * Depois de gravar documentos: relê-os (1 leitura cada) e atualiza só esses itens na
 * lista materializada. Documento inexistente ou de outra empresa sai da lista.
 */
export async function touchMaterialized(
  db: Firestore,
  coll: MaterializedCollection,
  companyId: string,
  ids: string[]
): Promise<void> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return
  await writeEntries(db, coll, companyId, async (tx) => {
    const snaps = await tx.getAll(...unique.map((id) => db.collection(coll).doc(id)))
    return snaps.map((s) => ({
      id: s.id,
      data: s.exists && s.data()?.companyId === companyId ? (s.data() as Record<string, any>) : null,
    }))
  })
}

/**
 * Com o documento completo já conhecido (acabado de criar, ou apagado → null): não relê
 * nada. Para alterar só alguns campos usar patchFieldsMaterialized.
 */
export async function patchMaterialized(
  db: Firestore,
  coll: MaterializedCollection,
  companyId: string,
  entries: Entry[]
): Promise<void> {
  if (entries.length === 0) return
  const clean = entries.map((e) => ({ id: e.id, data: e.data ? JSON.parse(JSON.stringify(e.data)) : null }))
  await writeEntries(db, coll, companyId, async () => clean)
}

/**
 * Junta só estes campos aos itens, a partir das fatias atuais lidas na transação (1 leitura
 * por fatia, não por documento) — nunca repõe o resto do item a partir de uma cópia antiga.
 * Para escritas em lote (numeração das OTs, nome do técnico).
 */
export async function patchFieldsMaterialized(
  db: Firestore,
  coll: MaterializedCollection,
  companyId: string,
  entries: { id: string; fields: Record<string, any> }[]
): Promise<void> {
  if (entries.length === 0) return
  await writeEntries(db, coll, companyId, async (tx, meta) => {
    const shardIdx = Array.from(new Set(entries.map((e) => shardOf(e.id, meta.shards))))
    const snaps = await tx.getAll(...shardIdx.map((i) => shardRef(db, coll, companyId, meta.buildId, i)))
    const current = new Map<string, MaterializedItem>()
    for (const s of snaps) for (const [id, item] of parseShard(s.data()?.items)) current.set(id, item)
    const out: Entry[] = []
    for (const e of entries) {
      const item = current.get(e.id)
      // Item ausente da cópia: fica para a próxima reconstrução (não inventar o resto).
      if (!item) continue
      const { id: _id, ...rest } = item
      out.push({ id: e.id, data: JSON.parse(JSON.stringify({ ...rest, ...e.fields })) })
    }
    return out
  })
}

/** Para os testes: esquece a memória desta instância. */
export function forgetMaterializedMemo(): void {
  memo.clear()
}
