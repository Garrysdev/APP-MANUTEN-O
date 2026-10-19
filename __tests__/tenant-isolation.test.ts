/**
 * Simulação com duas empresas (A e B) sobre um Firestore em memória, a chamar as funções
 * reais de src/lib/firebase/data.ts. Verifica que:
 *  1. as listas de cada empresa só têm dados dela (nem da outra, nem da reserva da UR);
 *  2. a empresa A não consegue ler, alterar nem apagar dados da B pelo id;
 *  3. os dados da B ficam intactos depois das tentativas da A.
 * As escritas em ficheiros (scripts/import/*.json) são desligadas.
 */
import fs from 'fs'
import { FakeFirestore, FieldValue } from '../test-utils/fake-firestore'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('react', () => ({ ...jest.requireActual('react'), cache: (fn: unknown) => fn }))
jest.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: () => {}, revalidatePath: () => {} }))
jest.mock('@/lib/notifications', () => ({ sendTaskAssignedEmail: async () => {}, sendUrgentTaskEmail: async () => {} }))
jest.mock('@/lib/webpush-server', () => ({ sendWebPush: async () => {} }))
jest.mock('firebase-admin/firestore', () => ({ FieldValue: require('../test-utils/fake-firestore').FieldValue, getFirestore: () => { throw new Error('getFirestore não deve ser usado') } }))

const db = new FakeFirestore()
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: () => db,
  adminAuth: () => ({
    updateUser: async () => ({}),
    revokeRefreshTokens: async () => {},
    deleteUser: async () => {},
    createUser: async ({ email }: { email: string }) => ({ uid: `auth_${email}` }),
    getUser: async () => null,
  }),
  firestoreWithTimeout: async (fn: () => Promise<unknown>, fallback: unknown) => {
    try { return await fn() } catch { return fallback }
  },
  isQuotaExhausted: () => false,
  markQuotaExhausted: () => {},
  logReads: () => {},
}))

import * as data from '@/lib/firebase/data'

const A = 'companyAAAAAAAAAAAAA'
const B = 'companyBBBBBBBBBBBBB'
const UR = data.DEMO_COMPANY_ID

const ids: Record<string, Record<'A' | 'B', string>> = {}
const anyData = (v: Record<string, unknown>) => v as any

async function attempt(fn: () => Promise<unknown>) {
  try { await fn() } catch { /* recusado — o que importa é o estado final */ }
}

beforeAll(async () => {
  jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'info').mockImplementation(() => {})

  for (const [key, company] of [['A', A], ['B', B]] as const) {
    db.seed('companies', company, { name: `Empresa ${key}`, plan: 'enterprise' })
    db.seed('users', `mgr${key}`, { companyId: company, name: `Gestor ${key}`, email: `gestor${key.toLowerCase()}@x.pt`, role: 'manager', active: true })
    db.seed('users', `tech${key}`, { companyId: company, name: `Técnico ${key}`, email: `tecnico${key.toLowerCase()}@x.pt`, role: 'technician', active: true, abbreviation: `T${key}` })
  }

  for (const [key, company] of [['A', A], ['B', B]] as const) {
    const k = key as 'A' | 'B'
    const put = (name: string, id: string) => { (ids[name] ||= {} as any)[k] = id }
    put('asset', await data.createAsset(company, anyData({ name: `Equip ${key}`, tag: `TAG-${key}`, area: `AREA-${key}` })))
    put('task', await data.createTask(company, `mgr${key}`, anyData({
      title: `OT ${key}`, assetId: ids.asset[k], tag: `TAG-${key}`, status: 'pending', tipo: 'preventiva', criticidade: 'verde',
    })))
    put('plan', await data.createMaintenancePlan(company, `mgr${key}`, anyData({
      title: `Plano ${key}`, code: `PM-${key}`, assetId: ids.asset[k], periodicidade: 'mensal', active: true, executor: 'interno', criticidade: 'verde',
    })))
    put('stock', await data.createStockItem(company, anyData({ name: `Peça ${key}`, quantity: 5, minQuantity: 1, unit: 'un' })))
    put('warehouse', await data.createWarehouse(company, anyData({ name: `Armazém ${key}` })))
    put('rule', await data.createSafetyRule(company, anyData({ text: `Regra ${key}`, title: `Regra ${key}`, category: 'Geral' })))
    put('doc', await data.createDocument(company, anyData({ type: 'FR', code: `FR-${key}`, title: `Folha ${key}`, fieldLabels: ['x'], active: true })))
    put('extCompany', await data.createExternalCompany(company, anyData({ name: `Prestador ${key}` })))
    put('message', await data.createInternalMessage(company, `mgr${key}`, anyData({
      subject: `Assunto ${key}`, content: `Mensagem ${key}`, recipientIds: ['ALL'], recipientNames: 'Todos', senderName: `Gestor ${key}`,
    })))
    put('notification', await data.createNotification(company, anyData({ userId: `tech${key}`, type: 'info', title: `Aviso ${key}`, body: `Corpo ${key}` })))
    put('intervention', await data.createIntervention(company, anyData({ taskId: ids.task[k], technicianId: `tech${key}`, observations: `Interv ${key}` })))
  }
})

describe('listas: cada empresa só vê os seus dados', () => {
  const cases: [string, (c: string) => Promise<any[]>, (x: any) => string][] = [
    ['OTs', (c) => data.listTasks(c), (x) => x.title],
    ['equipamentos', (c) => data.listAssets(c), (x) => x.name],
    ['planos', (c) => data.listMaintenancePlans(c), (x) => x.title],
    ['stocks', (c) => data.listStockItems(c), (x) => x.name],
    ['armazéns', (c) => data.listWarehouses(c), (x) => x.name],
    ['regras de segurança', (c) => data.listSafetyRules(c), (x) => x.title || x.text],
    ['documentos', (c) => data.listDocuments(c), (x) => x.title],
    ['empresas externas', (c) => data.listExternalCompanies(c), (x) => x.name],
    ['mensagens', (c) => data.listInternalMessages(c), (x) => x.content],
    ['intervenções', (c) => data.listInterventions(c), (x) => x.observations],
    ['utilizadores', (c) => data.listUsers(c), (x) => x.name],
  ]

  it.each(cases)('%s', async (_label, list, label) => {
    for (const [own, ownKey, other, otherId] of [[A, 'A', 'B', B], [B, 'B', 'A', A]] as const) {
      const rows = await list(own)
      // Controlo positivo: a lista traz os dados da própria empresa (senão "não ver os da
      // outra" seria trivialmente verdade).
      expect(rows.some((r) => r.companyId === own && String(label(r) || '').endsWith(` ${ownKey}`))).toBe(true)
      expect(rows.some((r) => r.companyId === otherId)).toBe(false)
      expect(rows.some((r) => String(label(r) || '').endsWith(` ${other}`))).toBe(false)
      // Nada da reserva da Empresa UR numa empresa cliente.
      expect(rows.some((r) => r.companyId === UR)).toBe(false)
    }
  })

  it('notificações', async () => {
    const forA = await data.listNotifications(A, 'techA')
    const forB = await data.listNotifications(B, 'techB')
    // Inclui também a notificação (legítima) da mensagem do próprio gestor.
    expect(forA.map((n) => n.title)).toContain('Aviso A')
    expect(forB.map((n) => n.title)).toContain('Aviso B')
    expect(forA.every((n) => n.companyId === A && !String(n.title).endsWith(' B'))).toBe(true)
    expect(forB.every((n) => n.companyId === B && !String(n.title).endsWith(' A'))).toBe(true)
  })

  it('OTs concluídas (paginadas) sem histórico da UR', async () => {
    const page = await data.listCompletedTasksPaged(A, 1, 50)
    expect(page.tasks.some((t) => t.companyId !== A)).toBe(false)
  })
})

describe('leituras por id: A não lê dados da B', () => {
  it.each([
    ['OT', () => data.getTask(A, ids.task.B)],
    ['equipamento', () => data.getAsset(A, ids.asset.B)],
    ['plano', () => data.getMaintenancePlan(A, ids.plan.B)],
    ['stock', () => data.getStockItem(A, ids.stock.B)],
  ])('%s', async (_label, read) => {
    expect(await read()).toBeNull()
  })
})

describe('escritas por id: A não altera nem apaga dados da B', () => {
  beforeAll(async () => {
    const hack = 'ALTERADO PELA EMPRESA A'
    await attempt(() => data.updateTask(A, ids.task.B, anyData({ title: hack, status: 'cancelled' })))
    await attempt(() => data.deleteTask(A, ids.task.B))
    await attempt(() => data.updateAsset(A, ids.asset.B, anyData({ name: hack })))
    await attempt(() => data.deleteAsset(A, ids.asset.B))
    await attempt(() => data.updateMaintenancePlan(A, ids.plan.B, anyData({ title: hack })))
    await attempt(() => data.deleteMaintenancePlan(A, ids.plan.B))
    await attempt(() => data.updateStockItem(A, ids.stock.B, anyData({ name: hack })))
    await attempt(() => data.deleteStockItem(A, ids.stock.B))
    await attempt(() => data.updateWarehouse(A, ids.warehouse.B, anyData({ name: hack })))
    await attempt(() => data.deleteWarehouse(A, ids.warehouse.B))
    await attempt(() => data.updateSafetyRule(A, ids.rule.B, anyData({ title: hack, text: hack })))
    await attempt(() => data.deleteSafetyRule(A, ids.rule.B))
    await attempt(() => data.updateDocument(A, ids.doc.B, anyData({ title: hack })))
    await attempt(() => data.deleteDocument(A, ids.doc.B))
    await attempt(() => data.updateExternalCompany(A, ids.extCompany.B, anyData({ name: hack })))
    await attempt(() => data.deleteExternalCompany(A, ids.extCompany.B))
    await attempt(() => data.updateInternalMessageStatus(A, ids.message.B, 'replied' as any))
    await attempt(() => data.deleteInternalMessage(A, ids.message.B))
    await attempt(() => data.markMessagesRead(A, [ids.message.B], 'mgrA'))
    await attempt(() => data.clearAllInternalMessages(A))
    await attempt(() => data.markNotificationRead(A, ids.notification.B))
    await attempt(() => data.deleteIntervention(A, ids.intervention.B))
    await attempt(() => data.calculateTaskCost(A, ids.task.B))
    await attempt(() => data.deactivateUser(A, 'techB'))
    await attempt(() => data.updateUserRate(A, 'techB', 999))
    await attempt(() => data.updateExternalTechnician(A, 'techB', anyData({ name: hack })))
    await attempt(() => data.deleteUserPermanent(A, 'techB'))
  })

  const untouched = (collection: string, key: string, field: string, expected: unknown) => async () => {
    const doc = db.raw(collection, ids[key].B)
    expect(doc).toBeDefined()
    expect(doc?.companyId).toBe(B)
    expect(doc?.deleted).not.toBe(true)
    expect(doc?.[field]).toBe(expected)
  }

  it('OT da B intacta', untouched('tasks', 'task', 'title', 'OT B'))
  it('estado da OT da B intacto', untouched('tasks', 'task', 'status', 'pending'))
  it('equipamento da B intacto', untouched('assets', 'asset', 'name', 'Equip B'))
  it('plano da B intacto', untouched('maintenance_plans', 'plan', 'title', 'Plano B'))
  it('stock da B intacto', untouched('stock_items', 'stock', 'name', 'Peça B'))
  it('armazém da B intacto', untouched('warehouses', 'warehouse', 'name', 'Armazém B'))
  it('documento da B intacto', untouched('documents', 'doc', 'title', 'Folha B'))
  it('empresa externa da B intacta', untouched('external_companies', 'extCompany', 'name', 'Prestador B'))
  it('intervenção da B intacta', untouched('interventions', 'intervention', 'observations', 'Interv B'))
  it('notificação da B continua por ler', untouched('notifications', 'notification', 'read', false))

  it('regra de segurança da B intacta', async () => {
    const doc = db.raw('safety_rules', ids.rule.B)
    expect(doc?.companyId).toBe(B)
    expect(JSON.stringify(doc)).not.toContain('ALTERADO')
  })

  it('mensagem da B intacta (estado, lida por, não apagada)', async () => {
    const doc = db.raw('internal_messages', ids.message.B)
    expect(doc?.companyId).toBe(B)
    expect(doc?.status).not.toBe('replied')
    expect(doc?.readBy || []).not.toContain('mgrA')
    const listB = await data.listInternalMessages(B)
    expect(listB.map((m) => m.content)).toContain('Mensagem B')
  })

  it('técnico da B continua na B, ativo e com o mesmo nome', async () => {
    const u = db.raw('users', 'techB')
    expect(u?.companyId).toBe(B)
    expect(u?.active).toBe(true)
    expect(u?.name).toBe('Técnico B')
    expect(u?.hourlyRate).toBeUndefined()
    expect(db.raw('deleted_users', 'techB')).toBeUndefined()
  })

  it('a lista da B continua completa', async () => {
    expect((await data.listTasks(B)).map((t) => t.title)).toContain('OT B')
    expect((await data.listUsers(B)).map((u) => u.name)).toEqual(expect.arrayContaining(['Gestor B', 'Técnico B']))
    expect((await data.listWarehouses(B)).map((w) => w.name)).toContain('Armazém B')
  })
})

describe('FR/IT obrigatórias', () => {
  it('não deixa concluir uma OT com FR por preencher; deixa depois de preenchida', async () => {
    const id = await data.createTask(A, 'mgrA', anyData({
      title: 'OT com FR', status: 'pending', tipo: 'preventiva', criticidade: 'verde', requiredFRs: [ids.doc.A], requiredITs: ['IT-01'],
    }))
    await expect(data.updateTask(A, id, anyData({ status: 'done' }))).rejects.toThrow(/Não é possível concluir/)
    expect(db.raw('tasks', id)?.status).toBe('pending')
    await data.updateTask(A, id, anyData({ completedFRs: { [ids.doc.A]: { f0: '6 bar' } }, acknowledgedITs: ['IT-01'] }))
    await data.updateTask(A, id, anyData({ status: 'done' }))
    expect(db.raw('tasks', id)?.status).toBe('done')
  })
})
