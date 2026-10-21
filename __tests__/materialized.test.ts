/**
 * Listas materializadas (src/lib/firebase/materialized.ts): depois de alterar UM documento,
 * reler a lista custa 1-2 leituras, não a coleção inteira — e o conteúdo fica certo.
 * As leituras são contadas como o Firestore as cobra (FakeFirestore.reads).
 */
import fs from 'fs'
import { FakeFirestore } from '../test-utils/fake-firestore'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('react', () => ({ ...jest.requireActual('react'), cache: (fn: unknown) => fn }))
jest.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: () => {}, revalidatePath: () => {} }))
jest.mock('@/lib/notifications', () => ({ sendTaskAssignedEmail: async () => {}, sendUrgentTaskEmail: async () => {} }))
jest.mock('@/lib/webpush-server', () => ({ sendWebPush: async () => {} }))
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: require('../test-utils/fake-firestore').FieldValue,
  FieldPath: require('../test-utils/fake-firestore').FieldPath,
  getFirestore: () => { throw new Error('getFirestore não deve ser usado') },
}))

const db = new FakeFirestore()
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: () => db,
  adminAuth: () => ({}),
  firestoreWithTimeout: async (fn: () => Promise<unknown>, fallback: unknown) => {
    try { return await fn() } catch { return fallback }
  },
  isQuotaExhausted: () => false,
  markQuotaExhausted: () => {},
  logReads: () => {},
}))

import * as data from '@/lib/firebase/data'
import { forgetMaterializedMemo, readMaterialized, touchMaterialized } from '@/lib/firebase/materialized'

const A = 'matCompanyAAAAAAAAAA'
const B = 'matCompanyBBBBBBBBBB'
const N = 300

const anyData = (v: Record<string, unknown>) => v as any

/** Leituras gastas por fn. */
async function readsOf(fn: () => Promise<unknown>): Promise<number> {
  const before = db.reads
  await fn()
  return db.reads - before
}

beforeAll(() => {
  jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'info').mockImplementation(() => {})
  // Descrição grande: obriga a lista de A a ficar repartida por várias fatias.
  const filler = 'x'.repeat(3000)
  for (let i = 0; i < N; i++) {
    db.seed('tasks', `a${i}`, {
      companyId: A, title: `OT A${i}`, description: filler, status: i % 2 ? 'pending' : 'done',
      createdAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    })
  }
  for (let i = 0; i < 5; i++) {
    db.seed('tasks', `b${i}`, { companyId: B, title: `OT B${i}`, status: 'pending', createdAt: '2026-02-01T00:00:00Z' })
  }
})

beforeEach(() => forgetMaterializedMemo())

describe('OTs', () => {
  it('a primeira leitura constrói a cópia (N leituras); a seguinte, sem alterações, custa 1', async () => {
    const first = await readsOf(() => data.listTasks(A))
    expect(first).toBeGreaterThanOrEqual(N)
    const second = await readsOf(() => data.listTasks(A))
    expect(second).toBe(1)
    expect((await data.listTasks(A)).length).toBe(N)
  })

  it('outra instância (sem memória) lê só o índice e as fatias, não as N OTs', async () => {
    const meta = db.raw('materialized', `tasks__${A}`)!
    expect(meta.shards).toBeGreaterThan(1)
    const reads = await readsOf(() => data.listTasks(A))
    expect(reads).toBe(1 + meta.shards)
  })

  it('editar UMA OT: a lista seguinte custa no máximo 2 leituras e mostra a alteração', async () => {
    await data.listTasks(A)
    await data.updateTask(A, 'a1', { title: 'OT A1 editada' })
    const reads = await readsOf(() => data.listTasks(A))
    expect(reads).toBeLessThanOrEqual(2)
    expect((await data.listTasks(A)).find((t) => t.id === 'a1')?.title).toBe('OT A1 editada')
  })

  it('noutra instância (outro servidor), uma edição custa 1 (índice) + 1 (a fatia alterada)', async () => {
    // Segunda cópia do módulo = memória de outro servidor, sobre o mesmo Firestore.
    let other!: typeof import('@/lib/firebase/materialized')
    jest.isolateModules(() => { other = require('@/lib/firebase/materialized') })
    await other.readMaterialized(db as any, 'tasks', A)
    await data.updateTask(A, 'a3', { title: 'OT A3 editada' })
    const meta = db.raw('materialized', `tasks__${A}`)!
    expect(meta.shards).toBeGreaterThan(1)
    let items: any[] = []
    const reads = await readsOf(async () => { items = await other.readMaterialized(db as any, 'tasks', A) })
    expect(reads).toBe(2)
    expect(items.find((t) => t.id === 'a3')?.title).toBe('OT A3 editada')
  })

  it('criar e apagar OTs reflete-se na lista sem reler a coleção', async () => {
    await data.listTasks(A)
    const id = await data.createTask(A, 'mgrA', anyData({ title: 'OT nova A', status: 'pending', tipo: 'curativa', criticidade: 'verde' }))
    let reads = await readsOf(() => data.listTasks(A))
    expect(reads).toBeLessThanOrEqual(2)
    expect((await data.listTasks(A)).some((t) => t.id === id)).toBe(true)

    await data.deleteTask(A, id)
    reads = await readsOf(() => data.listTasks(A))
    expect(reads).toBeLessThanOrEqual(2)
    expect((await data.listTasks(A)).some((t) => t.id === id)).toBe(false)
  })

  it('ativas, concluídas, por ano e por equipamento vêm todas da mesma cópia', async () => {
    await data.listTasks(A)
    const reads = await readsOf(async () => {
      await data.listTasks(A, 2000, false)
      await data.listCompletedTasksPaged(A, 1, 50)
      await data.getTasksForYearStats(A, 2026)
      await data.listTasksByAsset(A, 'qualquer')
    })
    expect(reads).toBe(4) // só o índice, uma vez por função
    expect((await data.listTasks(A, 2000, false)).every((t) => ['pending', 'in_progress', 'prazo'].includes(t.status))).toBe(true)
    expect((await data.listCompletedTasksPaged(A, 1, 500)).tasks.every((t) => t.status === 'done' || t.status === 'cancelled')).toBe(true)
  })

  it('a cópia de uma empresa nunca recebe documentos de outra', async () => {
    await data.listTasks(A)
    await touchMaterialized(db as any, 'tasks', A, ['b1'])
    await data.updateTask(A, 'b2', { title: 'tentativa' }).catch(() => {})
    const listA = await data.listTasks(A)
    expect(listA.some((t) => t.companyId === B)).toBe(false)
    const listB = await data.listTasks(B)
    expect(listB.map((t) => t.title).sort()).toEqual(['OT B0', 'OT B1', 'OT B2', 'OT B3', 'OT B4'])
  })

  it('escritas fora da app (scripts) aparecem quando a cópia fica velha (7 dias)', async () => {
    await data.listTasks(B)
    db.rawUpdate('tasks', 'b4', { title: 'mudado por script' })
    expect((await data.listTasks(B)).find((t) => t.id === 'b4')?.title).toBe('OT B4')
    const now = Date.now()
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now + 8 * 24 * 3600 * 1000)
    try {
      expect((await data.listTasks(B)).find((t) => t.id === 'b4')?.title).toBe('mudado por script')
    } finally {
      spy.mockRestore()
    }
  })

  it('cópia apagada ou marcada como desatualizada é reconstruída', async () => {
    db.rawUpdate('materialized', `tasks__${B}`, { stale: true })
    const reads = await readsOf(() => data.listTasks(B))
    expect(reads).toBeGreaterThanOrEqual(5)
    expect(await readsOf(() => data.listTasks(B))).toBe(1)
  })
})

describe('reconstrução segura', () => {
  const C = 'matCompanyCCCCCCCCCC'

  beforeAll(() => {
    for (let i = 0; i < 4; i++) db.seed('tasks', `c${i}`, { companyId: C, title: `OT C${i}`, status: 'pending', createdAt: '2026-03-01T00:00:00Z' })
  })

  it('uma edição feita DURANTE a reconstrução nunca se perde', async () => {
    let fired = false
    db.onQuery = async (coll) => {
      if (coll !== 'tasks' || fired) return
      fired = true
      // Outro utilizador grava enquanto a reconstrução está a ler a coleção.
      db.onQuery = undefined
      await data.updateTask(C, 'c0', { title: 'editada a meio' })
    }
    const list = await data.listTasks(C)
    db.onQuery = undefined
    expect(fired).toBe(true)
    expect(list.find((t) => t.id === 'c0')?.title).toBe('editada a meio')
    forgetMaterializedMemo()
    expect((await data.listTasks(C)).find((t) => t.id === 'c0')?.title).toBe('editada a meio')
  })

  it('reconstrução que falha a meio não estraga a cópia publicada e a lista vem certa', async () => {
    await data.listTasks(C)
    const before = db.raw('materialized', `tasks__${C}`)!
    db.rawUpdate('materialized', `tasks__${C}`, { stale: true })
    db.failWrite = (coll, id) => coll === 'materialized' && id.startsWith(`tasks__${C}__`) && !id.includes(before.buildId)
    const list = await data.listTasks(C)
    db.failWrite = undefined
    expect(list.map((t) => t.id).sort()).toEqual(['c0', 'c1', 'c2', 'c3'])
    // A antiga continua lá (não foi sobrescrita) e o índice pede reconstrução.
    expect(db.raw('materialized', `tasks__${C}__${before.buildId}__0`)).toBeDefined()
    expect(db.raw('materialized', `tasks__${C}`)!.stale).toBe(true)
    forgetMaterializedMemo()
    expect((await data.listTasks(C)).length).toBe(4)
    expect(db.raw('materialized', `tasks__${C}`)!.stale).toBe(false)
  })

  it('a reconstrução apaga as fatias da versão anterior', async () => {
    const old = db.raw('materialized', `tasks__${C}`)!
    db.rawUpdate('materialized', `tasks__${C}`, { stale: true })
    await data.listTasks(C)
    expect(db.raw('materialized', `tasks__${C}__${old.buildId}__0`)).toBeUndefined()
  })

  it('OT importada por script depois da cópia também é numerada (sem número repetido)', async () => {
    await data.listTasks(C)
    db.seed('tasks', 'c-script', { companyId: C, title: 'Importada', status: 'done', createdAt: '2019-01-01T00:00:00Z' })
    await data.backfillOtNumbers(C)
    const numbers = ['c0', 'c1', 'c2', 'c3', 'c-script'].map((id) => db.raw('tasks', id)!.otNumber)
    expect(numbers.every((n) => Number(n) > 0)).toBe(true)
    expect(new Set(numbers).size).toBe(numbers.length)
    expect((await data.listTasks(C)).find((t) => t.id === 'c-script')?.otNumber).toBe(db.raw('tasks', 'c-script')!.otNumber)
  })

  it('numerar em lote não repõe uma versão antiga dos outros campos', async () => {
    await data.listTasks(C)
    await data.updateTask(C, 'c1', { title: 'título novo' })
    const { patchFieldsMaterialized } = await import('@/lib/firebase/materialized')
    await patchFieldsMaterialized(db as any, 'tasks', C, [{ id: 'c1', fields: { otNumber: 999 } }])
    forgetMaterializedMemo()
    const c1 = (await data.listTasks(C)).find((t) => t.id === 'c1')
    expect(c1?.title).toBe('título novo')
    expect(c1?.otNumber).toBe(999)
  })
})

describe('equipamentos e planos', () => {
  it('equipamentos: criar/editar/apagar não obriga a reler a lista', async () => {
    const id = await data.createAsset(A, anyData({ name: 'Bomba 1', tag: 'P-1' }))
    await data.listAssets(A)
    await data.updateAsset(A, id, anyData({ name: 'Bomba 1 (revista)' }))
    expect(await readsOf(() => data.listAssets(A))).toBeLessThanOrEqual(2)
    expect((await data.listAssets(A)).find((a) => a.id === id)?.name).toBe('Bomba 1 (revista)')
    expect((await data.listAssetRefs(A)).find((a) => a.id === id)?.name).toBe('Bomba 1 (revista)')
    await data.deleteAsset(A, id)
    expect((await data.listAssets(A)).some((a) => a.id === id)).toBe(false)
  })

  it('planos: a lista e os planos do modal de OT vêm da cópia', async () => {
    const id = await data.createMaintenancePlan(A, 'mgrA', anyData({
      title: 'Lubrificar', code: 'PM-1', assetId: 'x', periodicidade: 'mensal', active: true, executor: 'interno', criticidade: 'verde',
    }))
    await data.listMaintenancePlans(A)
    await data.updateMaintenancePlan(A, id, anyData({ title: 'Lubrificar (novo)' }))
    expect(await readsOf(() => data.listMaintenancePlans(A))).toBeLessThanOrEqual(2)
    expect((await data.listMaintenancePlans(A)).find((p) => p.id === id)?.title).toBe('Lubrificar (novo)')
    expect(await readsOf(() => data.listPlanTaskRefs(A))).toBe(1)
    expect((await data.listPlanTaskRefs(A)).find((p) => p.id === id)?.title).toBe('Lubrificar (novo)')
    await data.deleteMaintenancePlan(A, id)
    expect((await data.listMaintenancePlans(A)).some((p) => p.id === id)).toBe(false)
  })
})

describe('memória partilhada entre pedidos simultâneos', () => {
  it('vários pedidos ao mesmo tempo fazem uma só leitura', async () => {
    await readMaterialized(db as any, 'tasks', A)
    forgetMaterializedMemo()
    const meta = db.raw('materialized', `tasks__${A}`)!
    const reads = await readsOf(() => Promise.all([1, 2, 3].map(() => readMaterialized(db as any, 'tasks', A))))
    expect(reads).toBe(1 + meta.shards)
  })
})
