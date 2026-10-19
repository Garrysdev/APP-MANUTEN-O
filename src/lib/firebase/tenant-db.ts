// Encaminhamento da base de dados por empresa ("uma base por cliente").
//
// Coleções CENTRAIS — ficam sempre na base partilhada (adminDb()): companies, users,
// invites, deleted_users, stripe_events. São as necessárias para login, convites,
// faturação e para saber a que empresa pertence um utilizador ANTES de escolher a base.
//
// Coleções da EMPRESA — tudo o resto (OTs, planos, equipamentos, intervenções, stocks,
// materiais, armazéns, regras, documentos, mensagens, notificações, empresas externas)
// vai para `await adminDbFor(companyId)`.
//
// De onde vem a base de cada empresa (por esta ordem):
//  1. TENANT_DATABASES (variável de ambiente, JSON) — empresa num PROJETO Firebase à
//     parte, com credenciais próprias: {"<companyId>": {projectId, clientEmail, privateKey}}
//  2. companies/<companyId>.databaseId — base com nome no MESMO projeto, criada
//     automaticamente por tenant-provision.ts (precisa do plano Blaze).
//  3. Nenhum dos dois → base partilhada "(default)" — o comportamento de sempre.
// O databaseId só é gravado na empresa DEPOIS de os dados estarem copiados, por isso uma
// empresa nunca é encaminhada para uma base vazia/incompleta.
import 'server-only'
import { unstable_cache } from 'next/cache'
import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { adminDb } from './admin'

type TenantCredentials = { projectId: string; clientEmail: string; privateKey: string }

let tenantConfig: Record<string, TenantCredentials> | null = null

function loadTenantConfig(): Record<string, TenantCredentials> {
  if (tenantConfig) return tenantConfig
  const raw = process.env.TENANT_DATABASES
  if (!raw) {
    tenantConfig = {}
    return tenantConfig
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<TenantCredentials>>
    const valid: Record<string, TenantCredentials> = {}
    for (const [companyId, c] of Object.entries(parsed)) {
      if (c?.projectId && c.clientEmail && c.privateKey) {
        valid[companyId] = {
          projectId: c.projectId,
          clientEmail: c.clientEmail,
          privateKey: c.privateKey.replace(/\\n/g, '\n'),
        }
      } else {
        console.error(`[tenant-db] Configuração incompleta para a empresa ${companyId} — ignorada.`)
      }
    }
    tenantConfig = valid
  } catch (err) {
    // Falhar de forma visível: cair em silêncio para a base partilhada misturaria os
    // dados de uma empresa dedicada com os das outras.
    throw new Error(`[tenant-db] TENANT_DATABASES inválida: ${(err as Error).message}`)
  }
  return tenantConfig
}

function tenantApp(companyId: string, creds: TenantCredentials): App {
  const name = `tenant-${companyId}`
  if (getApps().some((a) => a.name === name)) return getApp(name)
  return initializeApp({ credential: cert(creds), projectId: creds.projectId }, name)
}

// databaseId gravado na empresa. Data Cache da Vercel (partilhada entre instâncias,
// invalidada por revalidateTag('companies')) + memória por instância durante 60 s, para
// não ler a empresa a cada acesso a dados. Lança em erro: nunca adivinhar a base.
const readCompanyDatabaseId = unstable_cache(
  async (companyId: string): Promise<string | null> => {
    const snap = await adminDb().collection('companies').doc(companyId).get()
    const id = snap.exists ? snap.data()?.databaseId : null
    return typeof id === 'string' && id ? id : null
  },
  ['company-database-id'],
  { revalidate: 3600, tags: ['companies'] }
)

const MEMO_TTL_MS = 60 * 1000
const memo = new Map<string, { databaseId: string | null; at: number }>()

async function resolveNamedDatabase(companyId: string): Promise<string | null> {
  // Desligado até existirem bases com nome (ativar com TENANT_NAMED_DATABASES=1 quando o
  // plano Blaze estiver ativo e a criação automática correr): sem isto, cada acesso a
  // dados dependia de ler a empresa, com mais um ponto de falha e sem nenhum ganho.
  if (process.env.TENANT_NAMED_DATABASES !== '1') return null
  const hit = memo.get(companyId)
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.databaseId
  try {
    const databaseId = await readCompanyDatabaseId(companyId)
    memo.set(companyId, { databaseId, at: Date.now() })
    return databaseId
  } catch (err) {
    // Sem resposta: usar o último valor conhecido nesta instância; sem nenhum, falhar
    // (as funções de dados já tratam erros e caem para a reserva quando a há).
    if (hit) return hit.databaseId
    throw err
  }
}

/** Esquecer o valor em memória (após migrar a empresa para a base própria). */
export function forgetTenantDatabase(companyId: string): void {
  memo.delete(companyId)
}

/** Base de dados com os dados de negócio desta empresa (dedicada ou partilhada). */
export async function adminDbFor(companyId: string): Promise<Firestore> {
  if (!companyId) return adminDb()
  const creds = loadTenantConfig()[companyId]
  if (creds) return getFirestore(tenantApp(companyId, creds))
  const databaseId = await resolveNamedDatabase(companyId)
  return databaseId ? getFirestore(getApp(), databaseId) : adminDb()
}

/** Base com nome (mesmo projeto) — usado pelo backup e pela migração. */
export function namedDb(databaseId: string): Firestore {
  adminDb() // garante que a app por defeito está inicializada
  return getFirestore(getApp(), databaseId)
}

/** true se a empresa está num projeto Firebase à parte (TENANT_DATABASES). */
export function hasDedicatedProject(companyId: string): boolean {
  return !!companyId && !!loadTenantConfig()[companyId]
}

/** Empresas em projetos Firebase à parte (para o backup percorrer também essas bases). */
export function dedicatedCompanyIds(): string[] {
  return Object.keys(loadTenantConfig())
}
