// Encaminhamento por empresa (src/lib/firebase/tenant-db.ts): projeto à parte
// (TENANT_DATABASES) > base com nome gravada na empresa (companies.databaseId) > partilhada.
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

const apps: { name: string; projectId?: string }[] = []
jest.mock('firebase-admin/app', () => ({
  getApps: () => apps,
  getApp: (name = '[DEFAULT]') => apps.find((a) => a.name === name) ?? { name },
  cert: (c: unknown) => c,
  initializeApp: (opts: { projectId?: string }, name = '[DEFAULT]') => {
    const app = { name, projectId: opts.projectId }
    apps.push(app)
    return app
  },
}))
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: (app: { name: string }, databaseId?: string) => ({ db: databaseId ? `${app.name}/${databaseId}` : app.name }),
}))

// companies/<id>.databaseId simulado
let companyDocs: Record<string, { databaseId?: string }> = {}
let companyReadFails = false
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: () => ({
    db: 'shared',
    collection: () => ({
      doc: (id: string) => ({
        get: async () => {
          if (companyReadFails) throw new Error('quota')
          return { exists: id in companyDocs, data: () => companyDocs[id] }
        },
      }),
    }),
  }),
}))

const DEDICATED = {
  companyA: { projectId: 'proj-a', clientEmail: 'sa@proj-a.iam', privateKey: 'KEY\\nLINE' },
}

function load(envValue?: string) {
  apps.length = 0
  companyDocs = {}
  companyReadFails = false
  process.env.TENANT_NAMED_DATABASES = '1'
  if (envValue === undefined) delete process.env.TENANT_DATABASES
  else process.env.TENANT_DATABASES = envValue
  let mod: typeof import('@/lib/firebase/tenant-db')
  jest.isolateModules(() => {
    mod = require('@/lib/firebase/tenant-db')
  })
  return mod!
}

const dbName = async (p: Promise<unknown>) => ((await p) as { db: string }).db

describe('adminDbFor', () => {
  it('empresa sem base própria usa a base partilhada', async () => {
    const t = load()
    expect(await dbName(t.adminDbFor('companyA'))).toBe('shared')
  })

  it('com TENANT_NAMED_DATABASES desligado nem lê a empresa (base partilhada)', async () => {
    const t = load()
    process.env.TENANT_NAMED_DATABASES = '0'
    companyDocs = { companyB: { databaseId: 't-companyb' } }
    companyReadFails = true
    expect(await dbName(t.adminDbFor('companyB'))).toBe('shared')
  })

  it('empresa com databaseId gravado vai para a sua base com nome', async () => {
    const t = load()
    companyDocs = { companyB: { databaseId: 't-companyb' }, companyC: {} }
    expect(await dbName(t.adminDbFor('companyB'))).toBe('[DEFAULT]/t-companyb')
    expect(await dbName(t.adminDbFor('companyC'))).toBe('shared')
  })

  it('projeto à parte (TENANT_DATABASES) tem prioridade e reutiliza a app', async () => {
    const t = load(JSON.stringify(DEDICATED))
    expect(await dbName(t.adminDbFor('companyA'))).toBe('tenant-companyA')
    await t.adminDbFor('companyA')
    expect(apps.filter((a) => a.name === 'tenant-companyA')).toHaveLength(1)
    expect(t.dedicatedCompanyIds()).toEqual(['companyA'])
  })

  it('companyId vazio nunca escolhe uma base dedicada', async () => {
    const t = load(JSON.stringify({ '': DEDICATED.companyA }))
    expect(await dbName(t.adminDbFor(''))).toBe('shared')
  })

  it('sem conseguir ler a empresa e sem valor em memória, falha (nunca adivinha a base)', async () => {
    const t = load()
    companyReadFails = true
    await expect(t.adminDbFor('companyB')).rejects.toThrow('quota')
  })

  it('com valor em memória, uma falha de leitura usa o último conhecido', async () => {
    const t = load()
    companyDocs = { companyB: { databaseId: 't-companyb' } }
    await t.adminDbFor('companyB')
    companyReadFails = true
    expect(await dbName(t.adminDbFor('companyB'))).toBe('[DEFAULT]/t-companyb')
  })

  it('configuração incompleta é ignorada; JSON inválido falha de forma visível', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const t1 = load(JSON.stringify({ companyA: { projectId: 'proj-a' } }))
    expect(await dbName(t1.adminDbFor('companyA'))).toBe('shared')
    spy.mockRestore()
    const t2 = load('{nao-e-json')
    await expect(t2.adminDbFor('companyA')).rejects.toThrow(/TENANT_DATABASES inválida/)
  })
})
