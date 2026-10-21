// Firestore em memória, só com o que src/lib/firebase/data.ts usa: collection/doc,
// get/set(merge)/update/delete/add, where (==, in, >=, <, <=, >), orderBy, limit, select,
// getAll, batch, runTransaction, FieldPath e FieldValue.increment/arrayUnion/delete.
// Conta as leituras como o Firestore as cobra (`reads`), para testar o custo das listas.

type Data = Record<string, any>

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

export const FieldValue = {
  increment: (n: number) => ({ __op: 'inc', n }),
  arrayUnion: (...v: unknown[]) => ({ __op: 'union', v }),
  delete: () => ({ __op: 'delete' }),
}

export class FieldPath {
  readonly segments: string[]
  constructor(...segments: string[]) { this.segments = segments }
}

function applyValue(current: any, v: any): any {
  if (v && typeof v === 'object' && '__op' in v) {
    if (v.__op === 'inc') return (Number(current) || 0) + v.n
    if (v.__op === 'union') return Array.from(new Set([...(Array.isArray(current) ? current : []), ...v.v]))
    if (v.__op === 'delete') return undefined
  }
  return clone(v)
}

function setPath(target: Data, segments: string[], v: any): Data {
  const [head, ...rest] = segments
  const out = { ...target }
  if (rest.length === 0) {
    const next = applyValue(out[head], v)
    if (next === undefined) delete out[head]
    else out[head] = next
    return out
  }
  out[head] = setPath(out[head] && typeof out[head] === 'object' ? out[head] : {}, rest, v)
  return out
}

function applyWrite(current: Data, patch: Data): Data {
  let out = { ...current }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    out = setPath(out, [k], v)
  }
  return out
}

/** update(data) ou update(fieldPath, value, fieldPath, value, ...) → lista de [caminho, valor]. */
function updatePairs(args: any[]): [string[], any][] {
  if (args.length === 1 && !(args[0] instanceof FieldPath)) {
    return Object.entries(args[0] as Data).map(([k, v]) => [k.split('.'), v])
  }
  const pairs: [string[], any][] = []
  for (let i = 0; i + 1 < args.length; i += 2) {
    const f = args[i]
    pairs.push([f instanceof FieldPath ? f.segments : String(f).split('.'), args[i + 1]])
  }
  return pairs
}

function snapshot(ref: FakeDocRef, data: Data | undefined) {
  return { id: ref.id, ref, exists: data !== undefined, data: () => clone(data) }
}

export class FakeDocRef {
  constructor(private db: FakeFirestore, readonly collectionName: string, readonly id: string) {}
  private get table() { return this.db.table(this.collectionName) }
  async get() {
    if (this.db.failReads) throw new Error('8 RESOURCE_EXHAUSTED: Quota exceeded (simulado)')
    this.db.reads += 1
    return snapshot(this, this.table.get(this.id))
  }
  async set(data: Data, opts?: { merge?: boolean }) {
    if (this.db.failWrite?.(this.collectionName, this.id)) throw new Error('4 DEADLINE_EXCEEDED (simulado)')
    const base = opts?.merge ? this.table.get(this.id) ?? {} : {}
    this.table.set(this.id, applyWrite(base, data))
  }
  async update(...args: any[]) {
    const cur = this.table.get(this.id)
    if (!cur) throw new Error(`5 NOT_FOUND: ${this.collectionName}/${this.id}`)
    let out = cur
    for (const [segments, v] of updatePairs(args)) out = setPath(out, segments, v)
    this.table.set(this.id, out)
  }
  async delete() { this.table.delete(this.id) }
}

type Filter = { field: string; op: string; value: any }

class FakeQuery {
  constructor(
    protected db: FakeFirestore,
    protected name: string,
    protected filters: Filter[] = [],
    protected order: { field: string; dir: 'asc' | 'desc' } | null = null,
    protected max: number | null = null
  ) {}
  where(field: string, op: string, value: any) {
    return new FakeQuery(this.db, this.name, [...this.filters, { field, op, value }], this.order, this.max)
  }
  orderBy(field: string, dir: 'asc' | 'desc' = 'asc') {
    return new FakeQuery(this.db, this.name, this.filters, { field, dir }, this.max)
  }
  limit(n: number) { return new FakeQuery(this.db, this.name, this.filters, this.order, n) }
  select() { return this }
  count() {
    return {
      get: async () => {
        const s = await this.get()
        // Uma agregação count() custa 1 leitura (por cada 1000 documentos), não 1 por doc.
        this.db.reads -= Math.max(1, s.size) - 1
        return { data: () => ({ count: s.size }) }
      },
    }
  }
  async get() {
    if (this.db.failReads) throw new Error('8 RESOURCE_EXHAUSTED: Quota exceeded (simulado)')
    let rows = Array.from(this.db.table(this.name).entries()).filter(([, d]) =>
      this.filters.every(({ field, op, value }) => {
        const v = d[field]
        if (op === '==') return v === value
        if (op === 'in') return Array.isArray(value) && value.includes(v)
        if (op === 'array-contains') return Array.isArray(v) && v.includes(value)
        if (v === undefined || v === null) return false
        if (op === '>=') return v >= value
        if (op === '>') return v > value
        if (op === '<') return v < value
        if (op === '<=') return v <= value
        throw new Error(`operador não suportado no fake: ${op}`)
      })
    )
    if (this.order) {
      const { field, dir } = this.order
      rows = rows.filter(([, d]) => d[field] !== undefined)
      rows.sort(([, a], [, b]) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (dir === 'desc' ? -1 : 1))
    }
    if (this.max !== null) rows = rows.slice(0, this.max)
    // Uma query sem resultados também custa 1 leitura.
    this.db.reads += Math.max(1, rows.length)
    const docs = rows.map(([id, d]) => snapshot(new FakeDocRef(this.db, this.name, id), d))
    // Depois de tirar a fotografia: uma escrita aqui já não aparece neste resultado.
    if (this.db.onQuery) await this.db.onQuery(this.name)
    return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: any) => void) => docs.forEach(fn) }
  }
}

class FakeCollection extends FakeQuery {
  doc(id?: string) { return new FakeDocRef(this.db, this.name, id ?? this.db.nextId()) }
  async add(data: Data) {
    const ref = this.doc()
    await ref.set(data)
    return ref
  }
}

export class FakeFirestore {
  /** true → todas as leituras falham (simula quota esgotada / Firestore em baixo). */
  failReads = false
  /** Leituras cobradas desde o início (ou desde o último `reads = 0`). */
  reads = 0
  /** Chamado no início de cada query (para simular escritas a meio de uma leitura longa). */
  onQuery?: (collection: string) => Promise<void> | void
  /** true → o set() deste documento falha (simula uma gravação que falha a meio). */
  failWrite?: (collection: string, id: string) => boolean
  private tables = new Map<string, Map<string, Data>>()
  private counter = 0
  table(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, new Map())
    return this.tables.get(name)!
  }
  nextId() { return `auto${++this.counter}` }
  collection(name: string) { return new FakeCollection(this, name) }
  async getAll(...refs: FakeDocRef[]) { return Promise.all(refs.map((r) => r.get())) }
  // Transações em série (os testes não correm em paralelo): suficiente para o contador.
  private txQueue: Promise<unknown> = Promise.resolve()
  runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const run = this.txQueue.then(() => fn({
      get: (ref: FakeDocRef) => ref.get(),
      getAll: (...refs: FakeDocRef[]) => this.getAll(...refs),
      set: (ref: FakeDocRef, d: Data, o?: { merge?: boolean }) => ref.set(d, o),
      update: (ref: FakeDocRef, ...args: any[]) => ref.update(...args),
    }))
    this.txQueue = run.catch(() => {})
    return run
  }
  batch() {
    const ops: (() => Promise<void>)[] = []
    return {
      set: (ref: FakeDocRef, d: Data, o?: { merge?: boolean }) => { ops.push(() => ref.set(d, o)) },
      update: (ref: FakeDocRef, ...args: any[]) => { ops.push(() => ref.update(...args)) },
      delete: (ref: FakeDocRef) => { ops.push(() => ref.delete()) },
      commit: async () => { for (const op of ops) await op() },
    }
  }
  /** Leitura direta para as asserções (sem passar pelo código da app nem contar leituras). */
  raw(name: string, id: string): Data | undefined { return clone(this.table(name).get(id)) }
  seed(name: string, id: string, data: Data) { this.table(name).set(id, clone(data)) }
  /** Escrita direta, como um script externo ou a consola do Firebase (não passa pela app). */
  rawUpdate(name: string, id: string, patch: Data) {
    this.table(name).set(id, { ...(this.table(name).get(id) || {}), ...clone(patch) })
  }
}
