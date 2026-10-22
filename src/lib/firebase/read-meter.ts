// Contador de leituras do Firestore por coleção — só no servidor.
// Envolve os métodos de leitura do SDK (Query.get, Firestore.getAll, Transaction.get/getAll)
// para contar TODAS as leituras, não só as que passam por firestoreWithTimeout. Junta as
// leituras de cada rajada (pedidos seguidos na mesma instância) e escreve uma linha de
// resumo nos logs da Vercel: procurar "[fs-reads] resumo".
// Uma query sem resultados conta 1 leitura (regra de faturação do Firestore).
import { Firestore, Query, Transaction, type DocumentReference, type QuerySnapshot } from 'firebase-admin/firestore'

const FLUSH_DELAY_MS = 3000

type Bucket = { calls: number; docs: number }
let pending = new Map<string, Bucket>()
let timer: NodeJS.Timeout | null = null
let installed = false

function record(label: string, docs: number) {
  const prev = pending.get(label) || { calls: 0, docs: 0 }
  pending = new Map(pending).set(label, { calls: prev.calls + 1, docs: prev.docs + docs })
  if (!timer) {
    timer = setTimeout(flush, FLUSH_DELAY_MS)
    timer.unref?.()
  }
}

function flush() {
  timer = null
  if (pending.size === 0) return
  const entries = Array.from(pending.entries()).sort((a, b) => b[1].docs - a[1].docs)
  pending = new Map()
  const total = entries.reduce((s, [, b]) => s + b.docs, 0)
  const detail = entries.map(([label, b]) => `${label} ${b.docs} (${b.calls}x)`).join(', ')
  console.info(`[fs-reads] resumo: ${total} leituras — ${detail}`)
}

function queryLabel(q: unknown): string {
  const opts = (q as { _queryOptions?: { collectionId?: string; allDescendants?: boolean } })._queryOptions
  const name = opts?.collectionId || 'query'
  return opts?.allDescendants ? `${name}(group)` : `${name}(query)`
}

function refsLabel(args: unknown[]): string {
  const first = args.find((a): a is DocumentReference => Boolean(a && typeof a === 'object' && 'parent' in (a as object)))
  return `${first?.parent?.id || 'doc'}(doc)`
}

function countRefs(args: unknown[]): number {
  return args.filter((a) => Boolean(a && typeof a === 'object' && 'parent' in (a as object))).length
}

export function installReadMeter() {
  if (installed) return
  installed = true

  const queryGet = Query.prototype.get
  Query.prototype.get = async function (this: Query) {
    const snap = await queryGet.call(this)
    record(queryLabel(this), Math.max(1, snap.size))
    return snap
  } as typeof Query.prototype.get

  const dbGetAll = Firestore.prototype.getAll
  Firestore.prototype.getAll = async function (this: Firestore, ...args: any[]) {
    const snaps = await (dbGetAll as any).apply(this, args)
    record(refsLabel(args), countRefs(args))
    return snaps
  } as typeof Firestore.prototype.getAll

  const txGet = Transaction.prototype.get
  Transaction.prototype.get = async function (this: Transaction, refOrQuery: any) {
    const result = await (txGet as any).call(this, refOrQuery)
    if (refOrQuery instanceof Query) record(`tx:${queryLabel(refOrQuery)}`, Math.max(1, (result as QuerySnapshot).size))
    else record(`tx:${refsLabel([refOrQuery])}`, 1)
    return result
  } as typeof Transaction.prototype.get

  const txGetAll = Transaction.prototype.getAll
  Transaction.prototype.getAll = async function (this: Transaction, ...args: any[]) {
    const snaps = await (txGetAll as any).apply(this, args)
    record(`tx:${refsLabel(args)}`, countRefs(args))
    return snaps
  } as typeof Transaction.prototype.getAll
}
