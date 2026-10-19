// Encaminhamento por empresa (src/lib/firebase/tenant-db.ts): empresa sem configuração
// fica na base partilhada; empresa com configuração vai para a app Firebase própria.
jest.mock('server-only', () => ({}), { virtual: true })

const apps: { name: string; projectId?: string }[] = []
jest.mock('firebase-admin/app', () => ({
  getApps: () => apps,
  getApp: (name = '[DEFAULT]') => apps.find((a) => a.name === name),
  cert: (c: unknown) => c,
  initializeApp: (opts: { projectId?: string }, name = '[DEFAULT]') => {
    const app = { name, projectId: opts.projectId }
    apps.push(app)
    return app
  },
}))
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: (app: { name: string }) => ({ db: app.name }),
}))
jest.mock('@/lib/firebase/admin', () => ({ adminDb: () => ({ db: 'shared' }) }))

const DEDICATED = {
  companyA: { projectId: 'proj-a', clientEmail: 'sa@proj-a.iam', privateKey: 'KEY\\nLINE' },
}

function load(envValue?: string) {
  apps.length = 0
  if (envValue === undefined) delete process.env.TENANT_DATABASES
  else process.env.TENANT_DATABASES = envValue
  let mod: typeof import('@/lib/firebase/tenant-db')
  jest.isolateModules(() => {
    mod = require('@/lib/firebase/tenant-db')
  })
  return mod!
}

describe('adminDbFor', () => {
  it('sem TENANT_DATABASES usa a base partilhada para todas as empresas', () => {
    const t = load()
    expect(t.adminDbFor('companyA')).toEqual({ db: 'shared' })
    expect(t.hasDedicatedDb('companyA')).toBe(false)
  })

  it('empresa configurada vai para a sua própria app; as outras ficam na partilhada', () => {
    const t = load(JSON.stringify(DEDICATED))
    expect(t.adminDbFor('companyA')).toEqual({ db: 'tenant-companyA' })
    expect(t.adminDbFor('companyB')).toEqual({ db: 'shared' })
    expect(t.dedicatedCompanyIds()).toEqual(['companyA'])
  })

  it('reutiliza a mesma app em chamadas seguintes', () => {
    const t = load(JSON.stringify(DEDICATED))
    t.adminDbFor('companyA')
    t.adminDbFor('companyA')
    expect(apps.filter((a) => a.name === 'tenant-companyA')).toHaveLength(1)
  })

  it('companyId vazio nunca escolhe uma base dedicada', () => {
    const t = load(JSON.stringify({ '': DEDICATED.companyA }))
    expect(t.adminDbFor('')).toEqual({ db: 'shared' })
  })

  it('configuração incompleta é ignorada (fica na partilhada)', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const t = load(JSON.stringify({ companyA: { projectId: 'proj-a' } }))
    expect(t.adminDbFor('companyA')).toEqual({ db: 'shared' })
    spy.mockRestore()
  })

  it('JSON inválido falha de forma visível em vez de misturar dados', () => {
    const t = load('{nao-e-json')
    expect(() => t.adminDbFor('companyA')).toThrow(/TENANT_DATABASES inválida/)
  })
})
