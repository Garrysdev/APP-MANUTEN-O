// Encaminhamento da base de dados por empresa (Fase 1 do "Firebase por cliente").
//
// Coleções CENTRAIS — ficam sempre no projeto principal (adminDb()): companies, users,
// invites, deleted_users, stripe_events. São as necessárias para login, convites,
// faturação e para saber a que empresa pertence um utilizador ANTES de escolher a base.
//
// Coleções da EMPRESA — tudo o resto (OTs, planos, equipamentos, intervenções, stocks,
// materiais, armazéns, regras, documentos, mensagens, notificações, empresas externas)
// vai para adminDbFor(companyId). Uma empresa com base dedicada tem os dados num projeto
// Firebase só seu: isolamento físico (um bug deixa de conseguir misturar empresas) e
// quota própria.
//
// Configuração: variável de ambiente TENANT_DATABASES (JSON, marcar como Sensitive no
// Vercel), por exemplo:
//   {"<companyId>": {"projectId": "...", "clientEmail": "...", "privateKey": "-----BEGIN..."}}
// Empresa sem entrada → base partilhada (o comportamento de sempre). Sem a variável,
// todas as empresas ficam na base partilhada.
import 'server-only'
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

/** Base de dados com os dados de negócio desta empresa (dedicada ou partilhada). */
export function adminDbFor(companyId: string): Firestore {
  const creds = companyId ? loadTenantConfig()[companyId] : undefined
  if (!creds) return adminDb()
  return getFirestore(tenantApp(companyId, creds))
}

/** true se a empresa tem base de dados dedicada. */
export function hasDedicatedDb(companyId: string): boolean {
  return !!companyId && !!loadTenantConfig()[companyId]
}

/** Empresas com base dedicada (para o backup percorrer também essas bases). */
export function dedicatedCompanyIds(): string[] {
  return Object.keys(loadTenantConfig())
}
