// Acesso a dados (servidor) via Admin SDK. Todas as queries são scoped por companyId.
import 'server-only'
import { cache } from 'react'
import { unstable_cache, revalidateTag } from 'next/cache'
import fs from 'fs'
import path from 'path'
import type { DocumentSnapshot } from 'firebase-admin/firestore'
import { adminDb, adminAuth } from './admin'
import { sendTaskAssignedEmail, sendUrgentTaskEmail } from '../notifications'
import { sendWebPush } from '../webpush-server'
import { calculateTotalCost } from '../finance'
import { DEFAULT_TECHNICIAN_TYPES, type Asset, type Task, type User, type ExternalCompany, type Intervention, type Material, type Invite, type UserRole, type MaintenancePlan, type StockItem, type StockMovement, type Warehouse, type TaskCriticidade, type Periodicidade, type Executor, type SafetyRule, type AppNotification, type InternalMessage, type MessageStatus } from '@/types/models'

function serialize<T>(doc: DocumentSnapshot): T {
  return { id: doc.id, ...doc.data() } as T
}

export const DEMO_COMPANY_ID = 'rjHNaSUbLm4qTMyKP0oX'
export function isDemoCompany(companyId: string): boolean {
  if (!companyId) return false
  return companyId === DEMO_COMPANY_ID || companyId === 'demo' || companyId === 'demo_company'
}

// ── LOCAL FALLBACK LOADERS (Quando o Firebase Firestore atinge a quota diária) ──
let cachedFallbackAssets: Asset[] | null = null
function getFallbackAssets(): Asset[] {
  if (cachedFallbackAssets) return cachedFallbackAssets
  try {
    const filePath = path.join(process.cwd(), 'scripts', 'import', 'assets.json')
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const json = JSON.parse(raw)
      cachedFallbackAssets = json.map((item: any, idx: number) => ({
        id: `asset_ur_${idx + 1}`,
        companyId: 'rjHNaSUbLm4qTMyKP0oX',
        area: item.area || null,
        tag: item.tag || null,
        system: item.system || null,
        name: item.name || 'Equipamento',
        characteristics: item.characteristics || null,
        manufacturer: item.manufacturer || null,
        notes: item.notes || null,
        criticidadeABC: item.criticidadeABC || null,
        active: true,
        createdAt: new Date().toISOString()
      }))
      return cachedFallbackAssets!
    }
  } catch (err) {
    console.error('[Fallback] Error loading assets.json:', err)
  }
  return []
}

let cachedFallbackPlans: MaintenancePlan[] | null = null
function getFallbackPlans(): MaintenancePlan[] {
  if (cachedFallbackPlans) return cachedFallbackPlans
  try {
    const filePath = path.join(process.cwd(), 'scripts', 'import', 'plans.json')
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const json = JSON.parse(raw)
      cachedFallbackPlans = json.map((item: any, idx: number) => ({
        id: `plan_ur_${idx + 1}`,
        companyId: 'rjHNaSUbLm4qTMyKP0oX',
        area: item.area || null,
        tag: item.tag || null,
        system: item.system || null,
        title: item.title || item.acao || item.equipamento || 'Plano de Manutenção',
        description: item.acao || null,
        periodicidade: item.periodicidade || 'anual',
        periodicidadeLabel: item.periodicidadeLabel || null,
        executor: item.executor || 'interno',
        legal: !!item.legal,
        months: item.months || null,
        showInCalendar: item.showInCalendar === true,
        calendarStartDate: item.calendarStartDate || null,
        calendarDates: item.calendarDates || null,
        active: true,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
      return cachedFallbackPlans!
    }
  } catch (err) {
    console.error('[Fallback] Error loading plans.json:', err)
  }
  return []
}

let cachedFallbackTasks: Task[] | null = null
function getFallbackTasks(): Task[] {
  if (cachedFallbackTasks) return cachedFallbackTasks
  try {
    const filePath = path.join(process.cwd(), 'scripts', 'import', 'tasks.json')
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const json = JSON.parse(raw)
      cachedFallbackTasks = json.map((item: any, idx: number) => ({
        id: item.id || `task_${idx + 1}`,
        companyId: 'rjHNaSUbLm4qTMyKP0oX',
        title: item.title || 'Ordem de Trabalho',
        description: item.description || item.title || null,
        area: item.area || null,
        tag: item.tag || null,
        tipo: item.tipo || 'curativa',
        criticidade: item.criticidade || 'amarelo',
        status: item.status || 'pending',
        plannedStartDate: item.plannedStartDate || null,
        startedAt: item.startedAt || null,
        completedAt: item.completedAt || null,
        dueDate: item.dueDate || item.plannedStartDate || null,
        assignedTo: item.assignedTo || null,
        assignedToText: item.assignedToText || null,
        assignedToIds: item.assignedToIds || null,
        system: item.system || null,
        maintenancePlanId: item.maintenancePlanId || null,
        source: item.source || 'excel_ur',
        createdBy: item.createdBy || 'system',
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
      }))
      return cachedFallbackTasks!
    }
  } catch (err) {
    console.error('[Fallback] Error loading tasks.json:', err)
  }
  return []
}

let cachedFallbackUsers: User[] | null = null
function getFallbackUsers(): User[] {
  if (cachedFallbackUsers) return cachedFallbackUsers
  // IDs reais da equipa (users reais da Firestore) -- têm de bater certo com os IDs
  // gravados em assignedTo/assignedToIds nas tarefas, senão o nome não resolve durante
  // uma quebra de quota da Firestore e aparece o ID em bruto na UI.
  const techs = [
    { id: 'MEGjjvqtGqv3Oosxvlrx', name: 'Leandro Maia', abbreviation: 'LM', email: 'lm@rgmaintenance.pt', role: 'technician', active: true, isExternal: false, specialty: 'Multidisciplinar' },
    { id: 'nAcCSm4E3tNnPLr72UPl', name: 'Marco Silva', abbreviation: 'MS', email: 'ms@rgmaintenance.pt', role: 'technician', active: true, isExternal: false, specialty: 'Mecânico' },
    { id: 'zmDAeoGTzIWPavraKu0f', name: 'Carlos Branco', abbreviation: 'CB', email: 'cb@rgmaintenance.pt', role: 'technician', active: true, isExternal: false, specialty: 'Serralharia / Tubagem' },
    { id: 'mWSsTRtgq5QcOHusTdVYgDVrwHt2', name: 'RG - RuiG', abbreviation: 'RG', email: 'tecnico@teste.rg', role: 'technician', active: true, isExternal: false, specialty: 'Eletromecânica' },
    { id: 'CUodZKziOwo128GLK66i', name: 'Rui Garrido (RG)', abbreviation: 'RG', email: 'garrido.rui@gmail.com', role: 'manager', active: true, isExternal: false, specialty: 'Gestão de Manutenção' },
    { id: 'nLqzaMwMu1OR4CKZzatjTlNBWt82', name: 'Admin', abbreviation: 'ADM', email: 'demo@rgmaintenance.pt', role: 'manager', active: true, isExternal: false },
    { id: 'q17h5HdG3R8dfjWiUZ6V', name: 'Eng. João Ramos', abbreviation: 'JR', email: 'jr@rgmaintenance.pt', role: 'technician', active: true, isExternal: true, externalCompanyId: 'comp_jr', externalCompanyName: 'João Ramos Engenharia', specialty: 'Engenharia Geral', phone: '910 000 000' },
    { id: 'twtQs1sAj0RFc9KI2S0n', name: 'Miguel', abbreviation: 'OX2', email: 'ox2@rgmaintenance.pt', role: 'technician', active: true, isExternal: true, externalCompanyId: 'comp_ox2', externalCompanyName: 'OX2 Especialista', specialty: 'Caldeiras & Sobreaquecimento', phone: '912 345 678' },
    { id: '2pL85QsrLpaNwYXZdVOP', name: 'Carrier (Ricardo)', abbreviation: 'CAR', email: 'carrier@rgmaintenance.pt', role: 'technician', active: true, isExternal: true, externalCompanyId: 'comp_car', externalCompanyName: 'Carrier Portugal', specialty: 'HVAC / Climatização', phone: '965 432 109' },
    { id: 'tech_BlockControl', name: 'Nuno / João (BlockControl)', abbreviation: 'BLK', email: 'blockcontrol@rgmaintenance.pt', role: 'technician', active: true, isExternal: true, externalCompanyId: 'comp_blk', externalCompanyName: 'BlockControl Automação', specialty: 'Automação & Eletrónica', phone: '934 567 890' },
    { id: 'tech_Schindler', name: 'Equipa Téc. (Schindler)', abbreviation: 'SCH', email: 'schindler@rgmaintenance.pt', role: 'technician', active: true, isExternal: true, externalCompanyId: 'comp_sch', externalCompanyName: 'Schindler Elevadores', specialty: 'Elevadores & Cargas', phone: '210 987 654' },
    { id: 'tech_Helenos', name: 'Heleno (Helenos)', abbreviation: 'HEL', email: 'helenos@rgmaintenance.pt', role: 'technician', active: true, isExternal: true, externalCompanyId: 'comp_hel', externalCompanyName: 'Helenos S.A.', specialty: 'Construção & Estruturas', phone: '921 112 233' }
  ]
  cachedFallbackUsers = techs.map(t => ({
    ...t,
    companyId: 'rjHNaSUbLm4qTMyKP0oX',
    createdAt: new Date().toISOString()
  })) as User[]
  return cachedFallbackUsers
}

const listExternalCompaniesCached = unstable_cache(
  async (companyId: string): Promise<ExternalCompany[]> => {
    try {
      const snap = await adminDb()
        .collection('external_companies')
        .where('companyId', '==', companyId)
        .get()
      const docs = snap.docs.map((d) => serialize<ExternalCompany>(d))
      if (docs.length > 0 || !isDemoCompany(companyId)) return docs
    } catch (err) {
      console.error('[listExternalCompanies] Error:', err)
    }
    return isDemoCompany(companyId) ? getFallbackExternalCompanies() : []
  },
  ['external-companies'],
  { revalidate: 60, tags: ['external-companies'] }
)
export const listExternalCompanies = cache(async function(companyId: string): Promise<ExternalCompany[]> {
  return listExternalCompaniesCached(companyId)
})

function getFallbackExternalCompanies(): ExternalCompany[] {
  return [
    {
      id: 'comp_ox2',
      companyId: 'rjHNaSUbLm4qTMyKP0oX',
      name: 'OX2 Especialista',
      nif: '509123456',
      contactPerson: 'Eng. Pedro',
      phone: '912 345 678',
      email: 'ox2@rgmaintenance.pt',
      specialty: 'Caldeiras & Geradores de Vapor',
      address: 'Zona Industrial da Maia, Lote 14',
      active: true,
      notes: 'Prestador certificado para revisão de válvulas de segurança e caldeiras.'
    },
    {
      id: 'comp_blk',
      companyId: 'rjHNaSUbLm4qTMyKP0oX',
      name: 'BlockControl Automação',
      nif: '508765432',
      contactPerson: 'Nuno / João',
      phone: '934 567 890',
      email: 'blockcontrol@rgmaintenance.pt',
      specialty: 'Automação, PLCs & Variadores',
      address: 'Parque Tecnológico de Aveiro',
      active: true,
      notes: 'Assistência técnica a variadores Danfoss e PLCs Siemens.'
    },
    {
      id: 'comp_car',
      companyId: 'rjHNaSUbLm4qTMyKP0oX',
      name: 'Carrier Portugal',
      nif: '501234987',
      contactPerson: 'Ricardo',
      phone: '965 432 109',
      email: 'carrier@rgmaintenance.pt',
      specialty: 'Chillers & Climatização Industrial',
      address: 'Alameda dos Oceanos, Lisboa',
      active: true,
      notes: 'Manutenção preventiva e corretiva nos grupos de frio (Chillers).'
    },
    {
      id: 'comp_sch',
      companyId: 'rjHNaSUbLm4qTMyKP0oX',
      name: 'Schindler Elevadores',
      nif: '502345678',
      contactPerson: 'Apoio Técnico 24h',
      phone: '210 987 654',
      email: 'schindler@rgmaintenance.pt',
      specialty: 'Elevadores & Monta-cargas',
      address: 'Av. Defensores de Chaves, Lisboa',
      active: true,
      notes: 'Contrato de manutenção obrigatória de monta-cargas industriais.'
    },
    {
      id: 'comp_hel',
      companyId: 'rjHNaSUbLm4qTMyKP0oX',
      name: 'Helenos S.A.',
      nif: '503456789',
      contactPerson: 'Eng. Heleno',
      phone: '921 112 233',
      email: 'helenos@rgmaintenance.pt',
      specialty: 'Construção Civil & Serralharia Heavy Duty',
      address: 'Zona Industrial de Ovar',
      active: true,
      notes: 'Execução de coberturas, caleiras e estruturas metálicas.'
    }
  ]
}

// ── ASSETS ──────────────────────────────────────────────────────────────────
const listAssetsCached = unstable_cache(
  async (companyId: string, limitCount: number): Promise<Asset[]> => {
    try {
      const snap = await adminDb()
        .collection('assets')
        .where('companyId', '==', companyId)
        .limit(limitCount)
        .get()
      const dbDocs = snap.docs.map((d) => serialize<Asset>(d))
      if (dbDocs.length > 0) {
        return dbDocs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      }
      return isDemoCompany(companyId) ? getFallbackAssets() : []
    } catch (err) {
      console.error('[listAssets] Error:', err)
    }
    return isDemoCompany(companyId) ? getFallbackAssets() : []
  },
  ['assets'],
  { revalidate: 45, tags: ['assets'] }
)
export const listAssets = cache(async function(companyId: string, limitCount = 2000): Promise<Asset[]> {
  return listAssetsCached(companyId, limitCount)
})

/** Versão LEVE: id + name + tag (para dropdowns e mapa id→nome/tag). */
const listAssetRefsCached = unstable_cache(
  async (companyId: string): Promise<{ id: string; name: string; tag?: string | null; area?: string | null }[]> => {
    try {
      const snap = await adminDb()
        .collection('assets')
        .where('companyId', '==', companyId)
        .select('name', 'tag', 'area')
        .get()
      const dbDocs = snap.docs.map((d) => ({
        id: d.id,
        name: (d.data().name as string) ?? '',
        tag: (d.data().tag as string) ?? null,
        area: (d.data().area as string) ?? null,
      }))
      if (dbDocs.length > 0) {
        return dbDocs.sort((a, b) => a.name.localeCompare(b.name))
      }
      return isDemoCompany(companyId) ? getFallbackAssets().map(a => ({ id: a.id, name: a.name, tag: a.tag, area: a.area })) : []
    } catch (err) {
      console.error('[listAssetRefs] Error:', err)
    }
    return isDemoCompany(companyId) ? getFallbackAssets().map(a => ({ id: a.id, name: a.name, tag: a.tag, area: a.area })) : []
  },
  ['asset-refs'],
  { revalidate: 45, tags: ['assets'] }
)
export const listAssetRefs = cache(async function(companyId: string): Promise<{ id: string; name: string; tag?: string | null; area?: string | null }[]> {
  return listAssetRefsCached(companyId)
})

/** Refs LEVES de planos para o modal de criação de tarefas (só os campos usados, ativos com equipamento). */
export type PlanTaskRef = {
  id: string
  title: string
  assetId: string | null
  criticidade: TaskCriticidade
  periodicidade: Periodicidade | null
  periodicidadeLabel: string | null
  executor: Executor | null
  legal: boolean
  months: string | null
  safetyRules: string[] | null
}
export const listPlanTaskRefs = cache(async function(companyId: string): Promise<PlanTaskRef[]> {
  try {
    const snap = await adminDb()
      .collection('maintenance_plans')
      .where('companyId', '==', companyId)
      .select('title', 'assetId', 'criticidade', 'periodicidade', 'periodicidadeLabel', 'executor', 'legal', 'months', 'safetyRules', 'active')
      .get()
    return snap.docs
      .filter((d) => d.data().active !== false && d.data().assetId)
      .map((d) => {
        const x = d.data()
        return {
          id: d.id,
          title: x.title ?? '',
          assetId: x.assetId ?? null,
          criticidade: x.criticidade ?? 'verde',
          periodicidade: x.periodicidade ?? null,
          periodicidadeLabel: x.periodicidadeLabel ?? null,
          executor: x.executor ?? null,
          legal: x.legal ?? false,
          months: x.months ?? null,
          safetyRules: x.safetyRules ?? null,
        }
      })
  } catch (err) {
    console.error('[listPlanTaskRefs] Error:', err)
    return []
  }
})

export const getAsset = cache(async function(companyId: string, id: string): Promise<Asset | null> {
  try {
    let rawId = id
    try { rawId = decodeURIComponent(id).trim() } catch {}

    const doc = await adminDb().collection('assets').doc(rawId).get()
    if (doc.exists && doc.data()?.companyId === companyId) {
      return serialize<Asset>(doc)
    }

    // Busca por TAG em Firestore se o ID for uma TAG (ex: "90 H1 B1" ou "90 h1 b1")
    const snap = await adminDb().collection('assets')
      .where('companyId', '==', companyId)
      .where('tag', '==', rawId)
      .limit(1)
      .get()
    if (!snap.empty) {
      return serialize<Asset>(snap.docs[0])
    }

    const snapUpper = await adminDb().collection('assets')
      .where('companyId', '==', companyId)
      .where('tag', '==', rawId.toUpperCase())
      .limit(1)
      .get()
    if (!snapUpper.empty) {
      return serialize<Asset>(snapUpper.docs[0])
    }

    // Busca em todos os ativos da empresa (inclui fallbacks)
    const normAlpha = rawId.toLowerCase().replace(/[^a-z0-9]/g, '')
    const all = await listAssets(companyId)
    const matched = all.find((a) => {
      const aId = (a.id || '').toLowerCase()
      const aTag = (a.tag || '').toLowerCase()
      const aIdAlpha = aId.replace(/[^a-z0-9]/g, '')
      const aTagAlpha = aTag.replace(/[^a-z0-9]/g, '')
      return a.id === rawId || aTag === rawId.toLowerCase() || (normAlpha && (aIdAlpha === normAlpha || aTagAlpha === normAlpha))
    })
    if (matched) return matched
  } catch (err) {
    console.error('[getAsset] Error:', err)
  }
  if (!isDemoCompany(companyId)) return null
  const normAlphaFallback = id.toLowerCase().replace(/[^a-z0-9]/g, '')
  return getFallbackAssets().find((a) => a.id === id || a.tag === id || (normAlphaFallback && (a.id || '').replace(/[^a-z0-9]/g, '') === normAlphaFallback || (a.tag || '').replace(/[^a-z0-9]/g, '') === normAlphaFallback)) || null
})

export async function createAsset(
  companyId: string,
  data: Omit<Asset, 'id' | 'companyId' | 'createdAt'>
): Promise<string> {
  const ref = await adminDb()
    .collection('assets')
    .add({ ...data, companyId, createdAt: new Date().toISOString() })
  revalidateTag('assets')
  return ref.id
}

export async function updateAsset(
  companyId: string,
  id: string,
  data: Partial<Omit<Asset, 'id' | 'companyId' | 'createdAt'>>
): Promise<void> {
  const ref = adminDb().collection('assets').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Ativo não encontrado')
  await ref.update(data)
  revalidateTag('assets')
}

export async function deleteAsset(companyId: string, id: string): Promise<void> {
  const ref = adminDb().collection('assets').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Ativo não encontrado')
  await ref.delete()
  revalidateTag('assets')
}

// ── TASKS ───────────────────────────────────────────────────────────────────
const listTasksCached = unstable_cache(
  async (companyId: string, limitCount: number, includeCompleted: boolean): Promise<Task[]> => {
    try {
      let query = adminDb()
        .collection('tasks')
        .where('companyId', '==', companyId)

      if (!includeCompleted) {
        query = query.where('status', 'in', ['pending', 'in_progress']) as any
      }

      const snap = await query.limit(limitCount).get()
      const dbDocs = snap.docs
        .map((d) => serialize<Task>(d))
        .filter((t) => {
          // Manter SEMPRE todas as tarefas da folha UR
          if (t.source === 'excel_ur' || t.source === 'folha_ur_historico' || t.id.startsWith('task_excel_ur_') || t.id.includes('t-ur-')) {
            return true
          }
          // Filtrar OTs de PM em massa que possam ter sobrado
          const isScheduledPM = Boolean(
            (t as any).source === 'pm_agendamento_2026' ||
            (t as any).source === 'pm_anual_paragem_verao_2026' ||
            (t.title && (t.title.startsWith('[PM]') || t.title.startsWith('[MP]')))
          )
          if (isScheduledPM && t.status !== 'done') return false
          if (!includeCompleted && (t.status === 'done' || t.status === 'cancelled')) return false
          return true
        })

      if (!isDemoCompany(companyId)) {
        return dbDocs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      }
      let fallbacks = getFallbackTasks()
      if (!includeCompleted) {
        fallbacks = fallbacks.filter((f) => f.source === 'excel_ur' || (f.status !== 'done' && f.status !== 'cancelled'))
      }
      if (dbDocs.length === 0) return fallbacks

      const dbMap = new Map(dbDocs.map((d) => [d.id, d]))
      const mergedFallbacks = fallbacks.map((f) => dbMap.get(f.id) || f)
      const customDocs = dbDocs.filter((d) => !fallbacks.some((f) => f.id === d.id))
      return [...customDocs, ...mergedFallbacks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    } catch (err: any) {
      const isQuotaErr = String(err?.message || err).includes('Quota exceeded') || String(err?.message || err).includes('RESOURCE_EXHAUSTED')
      if (isQuotaErr) {
        console.warn('[listTasks] Quota do Firestore atingida. A usar dados de reserva.')
      } else {
        console.error('[listTasks] Error:', err)
      }
      let fallbacks = getFallbackTasks()
      if (!includeCompleted) {
        fallbacks = fallbacks.filter((f) => f.source === 'excel_ur' || (f.status !== 'done' && f.status !== 'cancelled'))
      }
      return isDemoCompany(companyId) ? fallbacks : []
    }
  },
  ['tasks'],
  { revalidate: 30, tags: ['tasks'] }
)

export const listTasks = cache(async function(
  companyId: string,
  limitCount = 2000,
  includeCompleted = true
): Promise<Task[]> {
  return listTasksCached(companyId, limitCount, includeCompleted)
})

export const listCompletedTasksPaged = cache(async function(
  companyId: string,
  page = 1,
  pageSize = 50
): Promise<{ tasks: Task[]; total: number }> {
  try {
    const snap = await adminDb()
      .collection('tasks')
      .where('companyId', '==', companyId)
      .where('status', 'in', ['done', 'cancelled'])
      .get()

    const dbDocs = snap.docs
      .map((d) => serialize<Task>(d))
      .sort((a, b) => (b.completedAt || b.updatedAt || b.createdAt || '').localeCompare(a.completedAt || a.updatedAt || a.createdAt || ''))

    const offset = (page - 1) * pageSize
    const paginated = dbDocs.slice(offset, offset + pageSize)
    return { tasks: paginated, total: dbDocs.length }
  } catch (err) {
    console.error('[listCompletedTasksPaged] Error:', err)
    const fallbacks = getFallbackTasks().filter((f) => f.status === 'done' || f.status === 'cancelled')
    const offset = (page - 1) * pageSize
    return { tasks: fallbacks.slice(offset, offset + pageSize), total: fallbacks.length }
  }
})

function normAlphaNumData(str?: string | null): string {
  if (!str) return ''
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export const listTasksByAsset = cache(async function(companyId: string, assetId: string, providedAssetTag?: string | null): Promise<Task[]> {
  const cleanTag = (providedAssetTag || '').trim().toLowerCase()
  const cleanId = (assetId || '').trim().toLowerCase()
  const tagAlpha = normAlphaNumData(providedAssetTag)
  const idAlpha = normAlphaNumData(assetId)

  try {
    let assetTag = providedAssetTag?.trim()
    if (!assetTag && !assetId.startsWith('asset_')) {
      assetTag = assetId
    }

    const queries: Promise<any>[] = [
      adminDb()
        .collection('tasks')
        .where('companyId', '==', companyId)
        .where('assetId', '==', assetId)
        .limit(200)
        .get()
        .catch(() => ({ docs: [] }))
    ]

    if (assetTag && assetTag !== assetId) {
      queries.push(
        adminDb()
          .collection('tasks')
          .where('companyId', '==', companyId)
          .where('tag', '==', assetTag)
          .limit(200)
          .get()
          .catch(() => ({ docs: [] }))
      )
    }

    const results = await Promise.all(queries)
    const dbDocs: Task[] = []
    results.forEach((snap) => {
      if (snap.docs) {
        snap.docs.forEach((d: any) => dbDocs.push(serialize<Task>(d)))
      }
    })

    const filterFn = (t: Task) => {
      if (t.assetId && (t.assetId === assetId || t.assetId.toLowerCase() === cleanId || normAlphaNumData(t.assetId) === idAlpha)) return true
      if (t.tag) {
        const tTagLower = t.tag.trim().toLowerCase()
        const tTagAlpha = normAlphaNumData(t.tag)
        if (cleanTag && (tTagLower === cleanTag || tTagAlpha === tagAlpha)) return true
        if (cleanId && (tTagLower === cleanId || tTagAlpha === idAlpha)) return true
      }
      return false
    }

    if (!isDemoCompany(companyId)) {
      return dbDocs.filter(filterFn).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    }

    const fallbacks = getFallbackTasks().filter(filterFn)
    const merged = Array.from(new Map([...dbDocs.filter(filterFn), ...fallbacks].map((t) => [t.id, t])).values())
    if (merged.length > 0) {
      return merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    }
  } catch (err) {
    console.error('[listTasksByAsset] Error:', err)
  }

  const fallbackFilter = (t: Task) => {
    if (t.assetId && (t.assetId === assetId || t.assetId.toLowerCase() === cleanId || normAlphaNumData(t.assetId) === idAlpha)) return true
    if (t.tag) {
      const tTagLower = t.tag.trim().toLowerCase()
      const tTagAlpha = normAlphaNumData(t.tag)
      if (cleanTag && (tTagLower === cleanTag || tTagAlpha === tagAlpha)) return true
      if (cleanId && (tTagLower === cleanId || tTagAlpha === idAlpha)) return true
    }
    return false
  }

  return isDemoCompany(companyId) ? getFallbackTasks().filter(fallbackFilter) : []
})

export const getTask = cache(async function(companyId: string, id: string): Promise<Task | null> {
  try {
    const doc = await adminDb().collection('tasks').doc(id).get()
    if (doc.exists && doc.data()?.companyId === companyId) {
      return serialize<Task>(doc)
    }
  } catch (err) {
    console.error('[getTask] Error:', err)
  }
  return isDemoCompany(companyId) ? (getFallbackTasks().find(t => t.id === id) || null) : null
})

export async function notifyAssignedTechnicians(
  companyId: string,
  taskId: string,
  taskTitle: string,
  assignedTo?: string | null,
  assignedToIds?: string[] | null,
  assignedToText?: string | null,
  area?: string | null,
  tag?: string | null,
  createdByName?: string | null,
  createdBy?: string | null
) {
  try {
    const allUsersSnap = await adminDb().collection('users').get().catch(() => null)
    if (!allUsersSnap) return
    const companyUsers = allUsersSnap.docs.map((d) => ({ ...serialize<User>(d), id: d.id }))

    const targetUserIds = new Set<string>()

    // 1. Verificação por ID direto em assignedTo
    if (assignedTo) {
      const aLower = assignedTo.toLowerCase().trim()
      companyUsers.forEach((u) => {
        if (
          (u.id.toLowerCase() === aLower ||
            (u.abbreviation && u.abbreviation.toLowerCase() === aLower) ||
            u.name.toLowerCase() === aLower ||
            aLower.replace(/^(tech_|user_)/, '') === (u.abbreviation || '').toLowerCase()) &&
          u.id !== createdBy
        ) {
          targetUserIds.add(u.id)
        }
      })
    }

    // 2. Verificação por array de IDs
    if (Array.isArray(assignedToIds)) {
      assignedToIds.forEach((id) => {
        const idLower = String(id || '').toLowerCase().trim()
        companyUsers.forEach((u) => {
          if (
            (u.id.toLowerCase() === idLower ||
              (u.abbreviation && u.abbreviation.toLowerCase() === idLower) ||
              u.name.toLowerCase() === idLower) &&
            u.id !== createdBy
          ) {
            targetUserIds.add(u.id)
          }
        })
      })
    }

    // 3. Verificação por tokens de texto (ex: "MS+RG", "LM", etc.)
    const textToScan = `${assignedToText || ''} ${typeof assignedTo === 'string' ? assignedTo : ''}`.trim().toLowerCase()
    if (textToScan) {
      const tokens = textToScan.split(/[\+,\/&|;\s]+/).map((s) => s.trim()).filter(Boolean)
      companyUsers.forEach((u) => {
        const uAbbr = (u.abbreviation || '').toLowerCase().trim()
        const uName = (u.name || '').toLowerCase().trim()
        if (
          ((uAbbr && tokens.includes(uAbbr)) ||
            (uName && tokens.includes(uName)) ||
            (u.id && tokens.includes(u.id.toLowerCase()))) &&
          u.id !== createdBy
        ) {
          targetUserIds.add(u.id)
        }
      })
    }

    const areaTagStr = [area, tag].filter(Boolean).join(' • ')
    for (const techId of Array.from(targetUserIds)) {
      await createNotification(companyId, {
        userId: techId,
        title: `📋 Nova OT Atribuída: ${taskTitle}`,
        body: `Foi-lhe atribuída uma nova Ordem de Trabalho${areaTagStr ? ` (${areaTagStr})` : ''}.`,
        type: 'task_assigned',
        link: `/dashboard/tasks`,
        senderName: createdByName || 'Gestor',
      }).catch(console.error)
    }
  } catch (err) {
    console.error('[notifyAssignedTechnicians] Error:', err)
  }
}

export async function createTask(
  companyId: string,
  createdBy: string,
  data: Omit<Task, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'> & { createdAt?: string }
): Promise<string> {
  const now = new Date().toISOString()
  let generatedId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  try {
    if (!data.assetId) {
      (data as any).assetId = data.tag || data.area || 'Geral'
    }
    if (data.assetId && (!data.tag || !data.area)) {
      const asset = await getAsset(companyId, data.assetId)
      if (asset) {
        if (!data.tag && asset.tag) (data as any).tag = asset.tag
        if (!data.area && asset.area) (data as any).area = asset.area
      }
    }
    const rawDoc = { createdAt: now, updatedAt: now, ...data, companyId, createdBy }
    const cleanObj = JSON.parse(JSON.stringify(rawDoc))
    const ref = await adminDb().collection('tasks').add(cleanObj)
    generatedId = ref.id

    // Notificar os técnicos atribuídos via Web Push e Notificação Interna
    await notifyAssignedTechnicians(
      companyId,
      generatedId,
      data.title,
      data.assignedTo,
      data.assignedToIds,
      (data as any).assignedToText,
      data.area,
      data.tag,
      data.createdByName,
      createdBy
    ).catch(console.error)

    if (data.criticidade === 'vermelho' || data.tipo === 'curativa') {
      await sendUrgentTaskEmail({ id: generatedId, title: data.title, companyId }).catch(() => {})
    }
  } catch (err) {
    console.error('Erro em createTask Firestore:', err)
  }

  const newTaskObj: Task = {
    id: generatedId,
    companyId,
    createdBy,
    createdAt: now,
    updatedAt: now,
    ...data,
  } as Task

  if (cachedFallbackTasks) {
    cachedFallbackTasks.unshift(newTaskObj)
  }

  try {
    const filePath = path.join(process.cwd(), 'scripts', 'import', 'tasks.json')
    if (fs.existsSync(filePath)) {
      const current = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      current.unshift(newTaskObj)
      fs.writeFileSync(filePath, JSON.stringify(current, null, 2))
    }
  } catch { /* read-only fs */ }

  revalidateTag('tasks')
  return generatedId
}

export async function updateTask(
  companyId: string,
  id: string,
  data: Partial<Omit<Task, 'id' | 'companyId' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  const ref = adminDb().collection('tasks').doc(id)
  const doc = await ref.get().catch(() => null)
  const now = new Date().toISOString()

  if (!doc || !doc.exists) {
    const rawDoc = {
      id,
      companyId,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      tipo: 'plano',
      criticidade: 'verde',
      ...data,
    }
    await ref.set(JSON.parse(JSON.stringify(rawDoc)), { merge: true }).catch(console.error)
  } else {
    await ref.update(JSON.parse(JSON.stringify({ ...data, updatedAt: now }))).catch(console.error)
  }

  if (cachedFallbackTasks) {
    const idx = cachedFallbackTasks.findIndex((t) => t.id === id)
    if (idx >= 0) {
      cachedFallbackTasks[idx] = { ...cachedFallbackTasks[idx], ...data, updatedAt: now }
    }
  }

  try {
    const filePath = path.join(process.cwd(), 'scripts', 'import', 'tasks.json')
    if (fs.existsSync(filePath)) {
      const current = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      const idx = current.findIndex((t: any) => t.id === id)
      if (idx >= 0) {
        current[idx] = { ...current[idx], ...data, updatedAt: now }
        fs.writeFileSync(filePath, JSON.stringify(current, null, 2))
      }
    }
  } catch { /* read-only fs */ }

  if (data.assignedTo || data.assignedToIds || (data as any).assignedToText) {
    const title = data.title || doc?.data()?.title || 'OT'
    await notifyAssignedTechnicians(
      companyId,
      id,
      title,
      data.assignedTo,
      data.assignedToIds,
      (data as any).assignedToText,
      data.area || doc?.data()?.area,
      data.tag || doc?.data()?.tag
    ).catch(console.error)
  }

  if (id.startsWith('plan_')) {
    const parts = id.split('_')
    const planId = parts[1]
    if (planId) {
      const planRef = adminDb().collection('maintenance_plans').doc(planId)
      const planDoc = await planRef.get().catch(() => null)
      if (planDoc && planDoc.exists) {
        const updatePlan: any = { updatedAt: now }
        if (data.dueDate) {
          updatePlan.nextDueDate = data.dueDate
          updatePlan.calendarStartDate = data.dueDate
          updatePlan.calendarDates = [data.dueDate]
        }
        if (data.assignedTo) updatePlan.assignedTo = data.assignedTo
        await planRef.update(updatePlan).catch(() => null)
      }
    }
  }
  revalidateTag('tasks')
}

export async function deleteTask(companyId: string, id: string): Promise<void> {
  const ref = adminDb().collection('tasks').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Tarefa não encontrada')
  await ref.delete()
  revalidateTag('tasks')
}

export async function deleteTasksByMaintenancePlan(companyId: string, planId: string): Promise<void> {
  try {
    const snap = await adminDb()
      .collection('tasks')
      .where('companyId', '==', companyId)
      .where('maintenancePlanId', '==', planId)
      .get()
    if (snap.empty) return
    const batch = adminDb().batch()
    snap.docs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
    revalidateTag('tasks')
  } catch (err) {
    console.error('[deleteTasksByMaintenancePlan] Error:', err)
  }
}

// ── USERS (para atribuição de tarefas) ────────────────────────────────────────
const listUsersCached = unstable_cache(
  async (companyId: string): Promise<User[]> => {
    try {
      const finalCompanyId = companyId || DEMO_COMPANY_ID
      const snap = await adminDb().collection('users').get()
      const allDbDocs = snap.docs.map((d) => serialize<User>(d))

      const PROTECTED_IDS = new Set([
        'MEGjjvqtGqv3Oosxvlrx', // Leandro Maia
        'nAcCSm4E3tNnPLr72UPl', // Marco Silva
        'zmDAeoGTzIWPavraKu0f', // Carlos Branco
        'mWSsTRtgq5QcOHusTdVYgDVrwHt2', // RG - RuiG
        'CUodZKziOwo128GLK66i', // Rui Garrido (RG)
      ])

      const isCorruptOrMock = (u: { email?: string | null; name?: string | null }) => {
        const email = String(u.email || '').toLowerCase().trim()
        const name = String(u.name || '').toLowerCase().trim()
        if (email.includes('@rg-maintenance.local')) return true
        if (name.includes('técnico ur') || email === 'ur@rgmaintenance.pt') return true
        if (name === 'mário silva' || name.includes('mário s.')) return true
        return false
      }

      const dbDocs = allDbDocs.filter((u) => {
        if (isCorruptOrMock(u)) return false
        if (!u.companyId) return true
        if (u.companyId === finalCompanyId) return true
        if (isDemoCompany(finalCompanyId) && isDemoCompany(u.companyId)) return true
        return false
      })

      let deletedIds = new Set<string>()
      let deletedEmails = new Set<string>()
      try {
        const delSnap = await adminDb().collection('deleted_users').get()
        delSnap.docs.forEach((d) => {
          if (!PROTECTED_IDS.has(d.id)) {
            deletedIds.add(d.id)
            const data = d.data()
            if (data?.email) deletedEmails.add(String(data.email).toLowerCase().trim())
          }
        })
      } catch { /* ignore */ }

      const isDeleted = (u: { id: string; email?: string | null }) => {
        if (PROTECTED_IDS.has(u.id)) return false
        if (deletedIds.has(u.id)) return true
        if (u.email && deletedEmails.has(String(u.email).toLowerCase().trim())) return true
        return false
      }

      // Merge fallback users with DB users: DB doc with matching ID or email takes precedence
      const userMap = new Map<string, User>()
      
      if (isDemoCompany(finalCompanyId)) {
        getFallbackUsers().forEach((f) => {
          if (!isDeleted(f) && !isCorruptOrMock(f)) {
            userMap.set(f.id, { ...f, companyId: finalCompanyId })
          }
        })
      }

      dbDocs.forEach((u) => {
        if (!isDeleted(u) && !isCorruptOrMock(u)) {
          // If a fallback has the same email or ID, remove the fallback key first
          for (const [key, existing] of userMap.entries()) {
            if (
              existing.id === u.id ||
              (existing.email && u.email && existing.email.toLowerCase() === u.email.toLowerCase())
            ) {
              userMap.delete(key)
            }
          }
          userMap.set(u.id, u)
        }
      })

      return Array.from(userMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt'))
    } catch (err) {
      console.error('[listUsers] Error:', err)
    }
    return isDemoCompany(companyId) ? getFallbackUsers() : []
  },
  ['users'],
  { revalidate: 30, tags: ['users'] }
)
export const listUsers = cache(async function(companyId: string): Promise<User[]> {
  return listUsersCached(companyId)
})

// ── REGISTO (cria empresa + gestor) ───────────────────────────────────────────
export async function createCompanyWithManager(
  uid: string,
  email: string,
  data: { companyName: string; userName: string }
): Promise<{ companyId: string }> {
  const db = adminDb()
  const now = new Date().toISOString()

  // slug simples a partir do nome da empresa
  const baseSlug = data.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'empresa'
  const slug = `${baseSlug}-${uid.slice(0, 6)}`

  const companyRef = db.collection('companies').doc()
  await companyRef.set({
    name: data.companyName.trim(),
    slug,
    plan: 'free',
    maxTechnicians: 1,
    logoUrl: null,
    createdAt: now,
  })

  await db.collection('users').doc(uid).set({
    companyId: companyRef.id,
    email,
    name: data.userName.trim(),
    role: 'manager',
    avatarUrl: null,
    active: true,
    createdAt: now,
  })

  return { companyId: companyRef.id }
}

// ── INTERVENTIONS (execução / histórico) ──────────────────────────────────────
export const listInterventions = cache(async function(companyId: string): Promise<Intervention[]> {
  try {
    const snap = await adminDb()
      .collection('interventions')
      .where('companyId', '==', companyId)
      .get()
    return snap.docs
      .map((d) => serialize<Intervention>(d))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch (err) {
    console.error('[listInterventions] Error:', err)
    return []
  }
})

export const listInterventionsByTask = cache(async function(
  companyId: string,
  taskId: string
): Promise<Intervention[]> {
  try {
    const snap = await adminDb()
      .collection('interventions')
      .where('companyId', '==', companyId)
      .where('taskId', '==', taskId)
      .get()
    const items = snap.docs.map((d) => serialize<Intervention>(d))
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  } catch (err) {
    console.error('[listInterventionsByTask] Error:', err)
    return []
  }
})

export async function createIntervention(
  companyId: string,
  data: Omit<Intervention, 'id' | 'companyId' | 'createdAt'>
): Promise<string> {
  const ref = await adminDb()
    .collection('interventions')
    .add({ ...data, companyId, createdAt: new Date().toISOString() })
  return ref.id
}

export async function deleteIntervention(companyId: string, id: string): Promise<void> {
  const ref = adminDb().collection('interventions').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId)
    throw new Error('Intervenção não encontrada')
  await ref.delete()
}

// ── MATERIALS ─────────────────────────────────────────────────────────────────
export const listMaterialsForInterventions = cache(async function(
  companyId: string,
  interventionIds: string[]
): Promise<Material[]> {
  if (interventionIds.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < interventionIds.length; i += 10)
    chunks.push(interventionIds.slice(i, i + 10))
  const results = await Promise.all(
    chunks.map((chunk) =>
      adminDb()
        .collection('materials')
        .where('companyId', '==', companyId)
        .where('interventionId', 'in', chunk)
        .get()
        .then((snap) => snap.docs.map((d) => serialize<Material>(d)))
    )
  )
  return results.flat()
})

export async function createMaterial(
  companyId: string,
  data: Omit<Material, 'id' | 'companyId' | 'createdAt'>
): Promise<string> {
  const ref = await adminDb()
    .collection('materials')
    .add({ ...data, companyId, createdAt: new Date().toISOString() })
  return ref.id
}

export async function deleteMaterial(companyId: string, id: string): Promise<void> {
  const ref = adminDb().collection('materials').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId)
    throw new Error('Material não encontrado')
  await ref.delete()
}

// ── INVITES ───────────────────────────────────────────────────────────────────
export async function createInviteToken(
  companyId: string,
  role: UserRole,
  email?: string
): Promise<{ id: string; token: string }> {
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const ref = await adminDb().collection('invites').add({
    companyId,
    role,
    token,
    used: false,
    email: email ?? null,
    expiresAt,
    createdAt: new Date().toISOString(),
  })
  return { id: ref.id, token }
}

export async function countPendingInvites(companyId: string): Promise<number> {
  const now = new Date().toISOString()
  const snap = await adminDb()
    .collection('invites')
    .where('companyId', '==', companyId)
    .where('used', '==', false)
    .where('expiresAt', '>', now)
    .get()
  return snap.size
}

export const getInviteByToken = cache(async function(token: string, callerEmail?: string): Promise<Invite | null> {
  const snap = await adminDb()
    .collection('invites')
    .where('token', '==', token)
    .limit(1)
    .get()
  if (snap.empty) return null
  const invite = serialize<Invite>(snap.docs[0])
  if (invite.used) return null
  if (invite.expiresAt && invite.expiresAt < new Date().toISOString()) return null
  if (invite.email && callerEmail && invite.email.toLowerCase() !== callerEmail.toLowerCase()) return null
  return invite
})

export async function markInviteUsed(id: string): Promise<void> {
  await adminDb().collection('invites').doc(id).update({ used: true })
}

// ── GESTÃO DE UTILIZADORES ─────────────────────────────────────────────────────
export async function createUserFromInvite(
  uid: string,
  email: string,
  name: string,
  companyId: string,
  role: UserRole
): Promise<void> {
  await adminDb().collection('users').doc(uid).set({
    companyId,
    email,
    name: name.trim(),
    role,
    avatarUrl: null,
    active: true,
    createdAt: new Date().toISOString(),
  })
  revalidateTag('users')
}

export async function deactivateUser(companyId: string, userId: string): Promise<void> {
  const ref = adminDb().collection('users').doc(userId)
  await ref.set({ active: false, companyId }, { merge: true })
  try {
    await adminAuth().updateUser(userId, { disabled: true })
    await adminAuth().revokeRefreshTokens(userId)
  } catch { /* ignore auth error for fallback users */ }
  revalidateTag('users')
}

export async function checkUserHasHistory(companyId: string, userId: string): Promise<boolean> {
  try {
    const userDoc = await adminDb().collection('users').doc(userId).get()
    const user = userDoc.exists ? userDoc.data() : null
    const abbr = user?.abbreviation || null

    const ivSnap = await adminDb()
      .collection('interventions')
      .where('companyId', '==', companyId)
      .where('technicianId', '==', userId)
      .limit(1)
      .get()
    if (!ivSnap.empty) return true

    if (abbr) {
      const ivSnapAbbr = await adminDb()
        .collection('interventions')
        .where('companyId', '==', companyId)
        .where('technicianId', '==', abbr)
        .limit(1)
        .get()
      if (!ivSnapAbbr.empty) return true
    }

    const taskSnapAssigned = await adminDb()
      .collection('tasks')
      .where('companyId', '==', companyId)
      .where('assignedTo', '==', userId)
      .limit(1)
      .get()
    if (!taskSnapAssigned.empty) return true

    if (abbr) {
      const taskSnapAbbr = await adminDb()
        .collection('tasks')
        .where('companyId', '==', companyId)
        .where('assignedTo', '==', abbr)
        .limit(1)
        .get()
      if (!taskSnapAbbr.empty) return true
    }
  } catch (err) {
    console.error('[checkUserHasHistory] Error:', err)
  }
  return false
}

export async function deleteUserPermanent(companyId: string, userId: string): Promise<void> {
  const ref = adminDb().collection('users').doc(userId)
  const doc = await ref.get()
  const userData = doc.exists ? doc.data() : null

  if (doc.exists && doc.data()?.companyId === companyId) {
    await ref.delete()
    try {
      await adminAuth().deleteUser(userId)
    } catch { /* ignore auth error for fallback users */ }
  }

  const fallback = getFallbackUsers().find((u) => u.id === userId)
  const email = userData?.email || fallback?.email || ''
  const abbr = userData?.abbreviation || fallback?.abbreviation || ''

  await adminDb().collection('deleted_users').doc(userId).set({
    companyId,
    email: email ? String(email).toLowerCase() : null,
    abbreviation: abbr ? String(abbr).toUpperCase() : null,
    deletedAt: new Date().toISOString(),
  }, { merge: true })
  revalidateTag('users')
}

export async function updateUserRate(companyId: string, userId: string, hourlyRate: number): Promise<void> {
  const ref = adminDb().collection('users').doc(userId)
  await ref.set({ hourlyRate, companyId }, { merge: true })
  revalidateTag('users')
}

export const getCompanyName = cache(async function(companyId: string): Promise<string | null> {
  try {
    const doc = await adminDb().collection('companies').doc(companyId).get()
    return doc.exists ? ((doc.data()?.name as string) ?? null) : 'Empresa UR'
  } catch (err) {
    console.error('[getCompanyName] Error / Quota Exceeded:', err)
    return 'Empresa UR'
  }
})

export const getTechnicianTypes = cache(async function(companyId: string): Promise<string[]> {
  try {
    const doc = await adminDb().collection('companies').doc(companyId).get()
    if (doc.exists) {
      const types = doc.data()?.technicianTypes
      if (Array.isArray(types) && types.length > 0) return types
    }
  } catch (err) {
    console.error('[getTechnicianTypes] Error / Quota Exceeded:', err)
  }
  return DEFAULT_TECHNICIAN_TYPES
})

export async function updateTechnicianTypes(companyId: string, technicianTypes: string[]): Promise<void> {
  await adminDb().collection('companies').doc(companyId).update({ technicianTypes })
}

export async function createUserDirect(
  companyId: string,
  data: {
    email: string
    name: string
    role: UserRole
    tempPassword: string
    avatarUrl?: string | null
    specialty?: string | null
    abbreviation?: string | null
    isExternal?: boolean
    externalCompanyId?: string | null
    externalCompanyName?: string | null
    phone?: string | null
  }
): Promise<string> {
  const finalEmail = data.email.includes('@') ? data.email.trim().toLowerCase() : `${data.email.trim().toLowerCase()}@rgmaintenance.pt`
  const authUser = await adminAuth().createUser({
    email: finalEmail,
    password: data.tempPassword,
    displayName: data.name,
  })
  await adminDb().collection('users').doc(authUser.uid).set({
    companyId,
    email: finalEmail,
    name: data.name.trim(),
    role: data.role,
    avatarUrl: data.avatarUrl ?? null,
    specialty: data.specialty ?? null,
    abbreviation: data.abbreviation ?? null,
    isExternal: data.isExternal ?? false,
    externalCompanyId: data.externalCompanyId ?? null,
    externalCompanyName: data.externalCompanyName ?? null,
    phone: data.phone ?? null,
    active: true,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  })
  revalidateTag('users')
  return authUser.uid
}

export async function updateUserProfile(
  userId: string,
  data: {
    name?: string
    email?: string
    avatarUrl?: string | null
    language?: string
    specialty?: string | null
    role?: UserRole
    abbreviation?: string | null
    active?: boolean
    pushSubscription?: any
    mustChangePassword?: boolean
    isExternal?: boolean
    externalCompanyId?: string | null
    externalCompanyName?: string | null
    phone?: string | null
    hourlyRate?: number
    companyId?: string
  }
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    companyId: data.companyId || DEMO_COMPANY_ID,
  }
  if (data.name !== undefined) update.name = data.name.trim()
  if (data.email !== undefined) update.email = data.email
  if (data.abbreviation !== undefined) update.abbreviation = data.abbreviation ? data.abbreviation.trim().toUpperCase() : null
  if (data.mustChangePassword !== undefined) update.mustChangePassword = data.mustChangePassword
  if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl
  if (data.language !== undefined) update.language = data.language
  if (data.specialty !== undefined) update.specialty = data.specialty
  if (data.role !== undefined) update.role = data.role
  if (data.active !== undefined) update.active = data.active
  if (data.pushSubscription !== undefined) update.pushSubscription = data.pushSubscription
  if (data.isExternal !== undefined) update.isExternal = data.isExternal
  if (data.externalCompanyId !== undefined) update.externalCompanyId = data.externalCompanyId
  if (data.externalCompanyName !== undefined) update.externalCompanyName = data.externalCompanyName
  if (data.phone !== undefined) update.phone = data.phone
  if (data.hourlyRate !== undefined) update.hourlyRate = data.hourlyRate

  // Atualizar também na cache em memória de fallbacks
  if (cachedFallbackUsers) {
    const idx = cachedFallbackUsers.findIndex(
      (u) => u.id === userId || (data.email && u.email?.toLowerCase() === data.email.toLowerCase())
    )
    if (idx !== -1) {
      cachedFallbackUsers[idx] = { ...cachedFallbackUsers[idx], ...(update as any) }
    } else {
      cachedFallbackUsers.push({ id: userId, ...(update as any) } as User)
    }
  }

  try {
    const sanitized = JSON.parse(JSON.stringify(update))
    await adminDb().collection('users').doc(userId).set(sanitized, { merge: true })
  } catch (err) {
    console.warn('[updateUserProfile] Firestore write failed / quota exceeded, updated in cache:', err)
  }
  revalidateTag('users')
}

export const countActiveUsers = cache(async function(companyId: string): Promise<number> {
  try {
    const snap = await adminDb()
      .collection('users')
      .where('companyId', '==', companyId)
      .get()
    const dbUsers = snap.docs.map((d) => d.data())
    return dbUsers.filter((u) => u.active !== false).length
  } catch {
    return 0
  }
})

export const countInterventionsThisMonth = cache(async function(companyId: string): Promise<number> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const all = await listInterventions(companyId)
  return all.filter((i) => i.createdAt >= startOfMonth).length
})

export const listInterventionsByTechnician = cache(async function(
  companyId: string,
  technicianId: string
): Promise<Intervention[]> {
  const all = await listInterventions(companyId)
  return all.filter(
    (i) =>
      i.technicianId === technicianId ||
      i.technicianId === 'tech_RG' ||
      i.technicianId === 'RG' ||
      i.technicianId === 'LM' ||
      i.technicianId === 'tech_LM'
  )
})

// ── MAINTENANCE PLANS ─────────────────────────────────────────────────────────

const listMaintenancePlansCached = unstable_cache(
  async (companyId: string): Promise<MaintenancePlan[]> => {
    try {
      const snap = await adminDb()
        .collection('maintenance_plans')
        .where('companyId', '==', companyId)
        .get()
      const dbDocs = snap.docs
        .map((d) => serialize<MaintenancePlan & { deleted?: boolean }>(d))
        .filter((p) => !p.deleted)

      if (dbDocs.length > 0) {
        const seen = new Set<string>()
        const uniquePlans: MaintenancePlan[] = []

        for (const p of dbDocs) {
          const key = (p.code || `${p.area || ''}_${p.tag || ''}_${p.title}`).toLowerCase().trim()
          if (!seen.has(key)) {
            seen.add(key)
            uniquePlans.push(p)
          }
        }
        return uniquePlans.sort((a, b) => (a.area || '').localeCompare(b.area || '', undefined, { numeric: true }) || a.title.localeCompare(b.title))
      }

      return isDemoCompany(companyId)
        ? getFallbackPlans().sort((a, b) => (a.area || '').localeCompare(b.area || '', undefined, { numeric: true }) || a.title.localeCompare(b.title))
        : []
    } catch (err) {
      console.error('[listMaintenancePlans] Error:', err)
    }
    return isDemoCompany(companyId) ? getFallbackPlans() : []
  },
  ['maintenance-plans'],
  { revalidate: 45, tags: ['plans'] }
)
export const listMaintenancePlans = cache(async function(companyId: string): Promise<MaintenancePlan[]> {
  return listMaintenancePlansCached(companyId)
})

export const getMaintenancePlan = cache(async function(companyId: string, id: string): Promise<MaintenancePlan | null> {
  try {
    const doc = await adminDb().collection('maintenance_plans').doc(id).get()
    if (doc.exists && doc.data()?.companyId === companyId && !doc.data()?.deleted) {
      return serialize<MaintenancePlan>(doc)
    }
  } catch (err) {
    console.error('[getMaintenancePlan] Error:', err)
  }
  return isDemoCompany(companyId) ? (getFallbackPlans().find(p => p.id === id) || null) : null
})

export async function createMaintenancePlan(
  companyId: string,
  createdBy: string,
  data: Omit<MaintenancePlan, 'id' | 'companyId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'lastGeneratedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  
  const codeToMatch = (data.code || '').trim()
  let existingDocId: string | null = null

  if (codeToMatch) {
    const snapCode = await adminDb()
      .collection('maintenance_plans')
      .where('companyId', '==', companyId)
      .where('code', '==', codeToMatch)
      .limit(1)
      .get()
      .catch(() => null)
    if (snapCode && !snapCode.empty) {
      existingDocId = snapCode.docs[0].id
    }
  }

  if (!existingDocId && data.title) {
    const snapTitle = await adminDb()
      .collection('maintenance_plans')
      .where('companyId', '==', companyId)
      .where('title', '==', data.title.trim())
      .limit(10)
      .get()
      .catch(() => null)

    if (snapTitle && !snapTitle.empty) {
      const match = snapTitle.docs.find((d) => {
        const dData = d.data()
        return String(dData.area || '').trim() === String(data.area || '').trim() &&
               String(dData.tag || '').trim() === String(data.tag || '').trim()
      })
      if (match) existingDocId = match.id
    }
  }

  if (existingDocId) {
    await adminDb().collection('maintenance_plans').doc(existingDocId).set(
      { ...data, updatedAt: now },
      { merge: true }
    )
    revalidateTag('plans')
    return existingDocId
  }

  const ref = await adminDb()
    .collection('maintenance_plans')
    .add({ ...data, companyId, createdBy, createdAt: now, updatedAt: now, lastGeneratedAt: null })
  revalidateTag('plans')
  return ref.id
}

export async function updateMaintenancePlan(
  companyId: string,
  id: string,
  data: Partial<Omit<MaintenancePlan, 'id' | 'companyId' | 'createdBy' | 'createdAt'>>
): Promise<void> {
  const now = new Date().toISOString()
  const ref = adminDb().collection('maintenance_plans').doc(id)
  const doc = await ref.get()
  if (doc.exists) {
    if (doc.data()?.companyId !== companyId) throw new Error('Plano de manutenção não encontrado')
    await ref.update({ ...data, updatedAt: now })
  } else {
    const fallback = isDemoCompany(companyId) ? getFallbackPlans().find((p) => p.id === id) : null
    const baseObj = fallback ? { ...fallback, ...data, companyId, updatedAt: now } : { ...data, companyId, createdAt: now, updatedAt: now }
    await ref.set(baseObj, { merge: true })
  }
  revalidateTag('plans')
}

export async function deleteMaintenancePlan(companyId: string, id: string): Promise<void> {
  const now = new Date().toISOString()
  const ref = adminDb().collection('maintenance_plans').doc(id)
  const doc = await ref.get()
  if (doc.exists) {
    if (doc.data()?.companyId !== companyId) throw new Error('Plano de manutenção não encontrado')
    await ref.delete()
  } else {
    await ref.set({ id, companyId, deleted: true, updatedAt: now })
  }
  revalidateTag('plans')
}

export const getUsersByCompany = cache(async function(companyId: string): Promise<User[]> {
  return listUsers(companyId)
})

let cachedFallbackStockItems: StockItem[] | null = null
function getFallbackStockItems(): StockItem[] {
  if (cachedFallbackStockItems) return cachedFallbackStockItems
  try {
    const filePath = path.join(process.cwd(), 'scripts', 'import', 'stocks.json')
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const json = JSON.parse(raw)
      cachedFallbackStockItems = json.map((item: any, idx: number) => ({
        id: item.id || `stock_item_${idx + 1}`,
        companyId: 'rjHNaSUbLm4qTMyKP0oX',
        code: item.code || item.reference || `STOCK-${idx + 1}`,
        name: item.name || 'Artigo de Consumo',
        category: item.category || 'Consumíveis',
        unit: item.unit || 'un',
        quantity: 0,
        minQuantity: item.minQuantity ?? 1,
        location: item.location || 'Armazém UR',
        cost: item.unitCost || item.cost || 0,
        unitCost: item.unitCost || item.cost || 0,
        area: item.area || null,
        tag: item.tag || null,
        system: item.system || null,
        description: item.description || null,
        supplier: item.supplier || null,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
      return cachedFallbackStockItems!
    }
  } catch (err) {
    console.error('[Fallback] Error loading stocks.json:', err)
  }
  return []
}

// ── STOCK ITEMS ───────────────────────────────────────────────────────────────

export const listStockItems = cache(async function(companyId: string): Promise<StockItem[]> {
  try {
    const snap = await adminDb()
      .collection('stock_items')
      .where('companyId', '==', companyId)
      .get()
    const docs = snap.docs.map((d) => serialize<StockItem>(d))
    if (docs.length > 0 || !isDemoCompany(companyId)) return docs.sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    console.error('[listStockItems] Error:', err)
  }
  return isDemoCompany(companyId) ? getFallbackStockItems() : []
})

export const getStockItem = cache(async function(companyId: string, id: string): Promise<StockItem | null> {
  try {
    const snap = await adminDb().collection('stock_items').doc(id).get()
    if (!snap.exists || snap.data()?.companyId !== companyId) return null
    return serialize<StockItem>(snap)
  } catch (err) {
    console.error('[getStockItem] Error:', err)
  }
  return isDemoCompany(companyId) ? (getFallbackStockItems().find((s) => s.id === id) || null) : null
})

export async function createStockItem(
  companyId: string,
  data: Omit<StockItem, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  try {
    const ref = await adminDb()
      .collection('stock_items')
      .add({ ...data, companyId, createdAt: now, updatedAt: now })
    return ref.id
  } catch (err) {
    // Nunca devolver um id fabricado aqui: o artigo não chegou a ser gravado, e um id
    // falso faria a UI dar a criação como boa e associá-lo a equipamentos que nunca
    // vão encontrá-lo. O erro tem de subir para quem chamou o poder mostrar.
    console.error('[createStockItem] Error:', err)
    throw err instanceof Error ? err : new Error('Erro ao gravar o artigo no inventário.')
  }
}

export async function updateStockItem(
  companyId: string,
  id: string,
  data: Partial<Omit<StockItem, 'id' | 'companyId' | 'createdAt'>>
): Promise<void> {
  try {
    const ref = adminDb().collection('stock_items').doc(id)
    const doc = await ref.get()
    if (doc.exists && doc.data()?.companyId === companyId) {
      await ref.update({ ...data, updatedAt: new Date().toISOString() })
    }
  } catch (err) {
    console.error('[updateStockItem] Error:', err)
  }
}

export async function deleteStockItem(companyId: string, id: string): Promise<void> {
  try {
    const ref = adminDb().collection('stock_items').doc(id)
    const doc = await ref.get()
    if (doc.exists && doc.data()?.companyId === companyId) {
      await ref.delete()
    }
  } catch (err) {
    console.error('[deleteStockItem] Error:', err)
  }
}

// ── WAREHOUSES (ARMAZÉNS) ───────────────────────────────────────────────────

let cachedWarehouses: Warehouse[] = [
  {
    id: 'wh_central',
    companyId: DEMO_COMPANY_ID,
    name: 'Armazém Central',
    address: 'Edifício Principal - Piso 0',
    notes: 'Armazém principal de peças e consumíveis',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'wh_ur',
    companyId: DEMO_COMPANY_ID,
    name: 'Armazém UR (Manutenção)',
    address: 'Oficina de Manutenção',
    notes: 'Peças sobressalentes e ferramentas',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
]

export const listWarehouses = cache(async function(companyId: string): Promise<Warehouse[]> {
  const finalCompanyId = companyId || DEMO_COMPANY_ID
  try {
    const snap = await adminDb().collection('warehouses').get()
    const docs = snap.docs.map((d) => serialize<Warehouse>(d))
    
    const map = new Map<string, Warehouse>()
    cachedWarehouses.forEach((w) => map.set(w.id, w))
    docs.forEach((w) => map.set(w.id, w))
    cachedWarehouses = Array.from(map.values())
  } catch (err) {
    console.warn('[listWarehouses] Firestore query failed / quota exceeded, using cache:', err)
  }
  
  const filtered = cachedWarehouses.filter((w) => {
    if (!w.companyId) return true
    if (w.companyId === finalCompanyId) return true
    if (isDemoCompany(finalCompanyId) && isDemoCompany(w.companyId)) return true
    return false
  })
  
  return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt'))
})

export async function createWarehouse(
  companyId: string,
  data: Omit<Warehouse, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const finalCompanyId = companyId || DEMO_COMPANY_ID
  const generatedId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const newWh: Warehouse = {
    id: generatedId,
    name: (data.name || '').trim(),
    address: data.address ? String(data.address).trim() : null,
    notes: data.notes ? String(data.notes).trim() : null,
    companyId: finalCompanyId,
    createdAt: now,
    updatedAt: now,
  }
  cachedWarehouses.unshift(newWh)

  try {
    const cleanObj = JSON.parse(JSON.stringify(newWh))
    const ref = await adminDb().collection('warehouses').add(cleanObj)
    newWh.id = ref.id
  } catch (err) {
    console.warn('[createWarehouse] Firestore add failed / quota exceeded, saved to cache:', err)
  }

  revalidateTag('warehouses')
  return newWh.id
}

export async function updateWarehouse(
  companyId: string,
  id: string,
  data: Partial<Omit<Warehouse, 'id' | 'companyId' | 'createdAt'>>
): Promise<void> {
  const item = cachedWarehouses.find((w) => w.id === id)
  if (item) {
    if (data.name !== undefined) item.name = data.name.trim()
    if (data.address !== undefined) item.address = data.address ? String(data.address).trim() : null
    if (data.notes !== undefined) item.notes = data.notes ? String(data.notes).trim() : null
    item.updatedAt = new Date().toISOString()
  }
  try {
    const cleanObj = JSON.parse(
      JSON.stringify({
        ...data,
        updatedAt: new Date().toISOString(),
      })
    )
    await adminDb().collection('warehouses').doc(id).update(cleanObj).catch(() => {})
  } catch (err) {
    console.warn('[updateWarehouse] Firestore update failed / quota exceeded:', err)
  }
  revalidateTag('warehouses')
}

export async function deleteWarehouse(companyId: string, id: string): Promise<void> {
  cachedWarehouses = cachedWarehouses.filter((w) => w.id !== id)
  try {
    await adminDb().collection('warehouses').doc(id).delete().catch(() => {})
  } catch (err) {
    console.warn('[deleteWarehouse] Firestore delete failed / quota exceeded:', err)
  }
  revalidateTag('warehouses')
}

export async function decrementStockQuantity(
  companyId: string,
  id: string,
  qty: number
): Promise<void> {
  try {
    const { FieldValue } = await import('firebase-admin/firestore')
    const ref = adminDb().collection('stock_items').doc(id)
    const doc = await ref.get()
    if (!doc.exists || doc.data()?.companyId !== companyId) return
    await ref.update({
      quantity: FieldValue.increment(-qty),
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[decrementStockQuantity] Error:', err)
  }
}

export async function incrementStockQuantity(
  companyId: string,
  id: string,
  qty: number
): Promise<void> {
  try {
    const { FieldValue } = await import('firebase-admin/firestore')
    const ref = adminDb().collection('stock_items').doc(id)
    const doc = await ref.get()
    if (!doc.exists || doc.data()?.companyId !== companyId) return
    await ref.update({
      quantity: FieldValue.increment(qty),
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[incrementStockQuantity] Error:', err)
  }
}

export async function createStockMovement(
  companyId: string,
  createdBy: string,
  data: Omit<StockMovement, 'id' | 'companyId' | 'createdBy' | 'createdAt'>
): Promise<string> {
  const now = new Date().toISOString()
  try {
    const ref = await adminDb().collection('stock_movements').add({
      ...data,
      companyId,
      createdBy,
      createdAt: now,
    })
    return ref.id
  } catch (err) {
    console.error('[createStockMovement] Error:', err)
    return `mov_${Date.now()}`
  }
}

export const listStockMovements = cache(async function(
  companyId: string,
  stockItemId: string
): Promise<StockMovement[]> {
  try {
    const snap = await adminDb()
      .collection('stock_movements')
      .where('companyId', '==', companyId)
      .where('stockItemId', '==', stockItemId)
      .get()
    return snap.docs
      .map((d) => serialize<StockMovement>(d))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch (err) {
    console.error('[listStockMovements] Error:', err)
    return []
  }
})

export const listMaterialsByName = cache(async function(companyId: string, name: string): Promise<Material[]> {
  try {
    const snap = await adminDb()
      .collection('materials')
      .where('companyId', '==', companyId)
      .where('name', '==', name)
      .get()
    return snap.docs
      .map((d) => serialize<Material>(d))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch (err) {
    console.error('[listMaterialsByName] Error:', err)
    return []
  }
})

export async function calculateTaskCost(companyId: string, taskId: string): Promise<void> {
  try {
    const interventionsSnap = await adminDb().collection('interventions')
      .where('companyId', '==', companyId).where('taskId', '==', taskId).get()
    const interventions = interventionsSnap.docs.map(d => serialize<Intervention>(d))

    const userRates: Record<string, number> = {}
    for (const inv of interventions) {
      if (inv.technicianId && userRates[inv.technicianId] === undefined) {
        const userSnap = await adminDb().collection('users').doc(inv.technicianId).get()
        userRates[inv.technicianId] = userSnap.data()?.hourlyRate || 0
      }
    }

    const materials: Material[] = []
    if (interventions.length > 0) {
      const interventionIds = interventions.map(i => i.id)
      const batches = []
      for (let i = 0; i < interventionIds.length; i += 10) batches.push(interventionIds.slice(i, i + 10))
      for (const batch of batches) {
        const matSnap = await adminDb().collection('materials')
          .where('companyId', '==', companyId)
          .where('interventionId', 'in', batch).get()
        matSnap.forEach(doc => materials.push(doc.data() as Material))
      }
    }

    const totalCost = calculateTotalCost(interventions, materials, userRates)
    await adminDb().collection('tasks').doc(taskId).update({ totalCost })
  } catch (err) {
    console.error('[calculateTaskCost] Error:', err)
  }
}

// ── SAFETY RULES (REGRAS DE SEGURANÇA) ──────────────────────────────────────
const DEFAULT_SAFETY_RULES: SafetyRule[] = [
  { id: 'sr_1', companyId: 'default', title: 'Uso obrigatório de EPI (Capacete, Luvas, Calçado de Segurança)', category: 'Geral', active: true, createdAt: new Date().toISOString() },
  { id: 'sr_2', companyId: 'default', title: 'Bloqueio e Etiquetagem de Energia (LOTO)', category: 'Elétrico', active: true, createdAt: new Date().toISOString() },
  { id: 'sr_3', companyId: 'default', title: 'Verificar ausência de tensão antes de intervir', category: 'Elétrico', active: true, createdAt: new Date().toISOString() },
  { id: 'sr_4', companyId: 'default', title: 'Utilizar arnês e linha de vida para trabalhos em altura (> 2m)', category: 'Trabalho em Altura', active: true, createdAt: new Date().toISOString() },
  { id: 'sr_5', companyId: 'default', title: 'Despressurizar circuitos hidráulicos e pneumáticos antes da desmontagem', category: 'Mecânico', active: true, createdAt: new Date().toISOString() },
  { id: 'sr_6', companyId: 'default', title: 'Ventilar e testar atmosfera em espaços confinados', category: 'Espaços Confinados', active: true, createdAt: new Date().toISOString() },
]

export const listSafetyRules = cache(async function(companyId: string): Promise<SafetyRule[]> {
  try {
    const snap = await adminDb()
      .collection('safety_rules')
      .where('companyId', '==', companyId)
      .get()
    const docs = snap.docs.map((d) => serialize<SafetyRule>(d))
    if (docs.length > 0) return docs.sort((a, b) => a.title.localeCompare(b.title))
  } catch (err) {
    console.error('[listSafetyRules] Error / Quota Exceeded:', err)
  }
  return DEFAULT_SAFETY_RULES
})

export async function createSafetyRule(
  companyId: string,
  data: Omit<SafetyRule, 'id' | 'companyId' | 'createdAt'>
): Promise<string> {
  const now = new Date().toISOString()
  try {
    const ref = await adminDb().collection('safety_rules').add({
      ...data,
      companyId,
      createdAt: now,
    })
    return ref.id
  } catch (err) {
    console.error('[createSafetyRule] Error:', err)
    return `sr_${Date.now()}`
  }
}

export async function updateSafetyRule(
  companyId: string,
  id: string,
  data: Partial<Omit<SafetyRule, 'id' | 'companyId' | 'createdAt'>>
): Promise<void> {
  try {
    const doc = await adminDb().collection('safety_rules').doc(id).get()
    if (doc.exists && doc.data()?.companyId === companyId) {
      await doc.ref.update(data)
    }
  } catch (err) {
    console.error('[updateSafetyRule] Error:', err)
  }
}

export async function deleteSafetyRule(companyId: string, id: string): Promise<void> {
  try {
    const doc = await adminDb().collection('safety_rules').doc(id).get()
    if (doc.exists && doc.data()?.companyId === companyId) {
      await doc.ref.delete()
    }
  } catch (err) {
    console.error('[deleteSafetyRule] Error:', err)
  }
}

// ── NOTIFICAÇÕES E MENSAGENS INTERNAS ────────────────────────────────────────

let cachedNotifications: AppNotification[] = []
let cachedInternalMessages: InternalMessage[] = []

const listNotificationsCached = unstable_cache(
  async (companyId: string, userId: string): Promise<AppNotification[]> => {
    try {
      const snap = await adminDb()
        .collection('notifications')
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get()
      const docs = snap.docs.map((d) => serialize<AppNotification>(d))
      if (docs.length > 0) {
        const uLower = String(userId || '').toLowerCase().trim()
        const uClean = uLower.replace(/^(tech_|user_)/, '')
        return docs.filter((n) => {
          const target = String(n.userId || '').toLowerCase().trim()
          const targetClean = target.replace(/^(tech_|user_)/, '')
          return target === uLower || target === uClean || targetClean === uClean
        })
      }
    } catch (err: any) {
      const isQuotaErr = String(err?.message || err).includes('Quota exceeded') || String(err?.message || err).includes('RESOURCE_EXHAUSTED')
      if (isQuotaErr) {
        console.warn('[listNotifications] Quota do Firestore atingida. A usar notificações locais.')
      } else {
        console.error('[listNotifications] Error:', err)
      }
    }
    const uLower = String(userId || '').toLowerCase().trim()
    const uClean = uLower.replace(/^(tech_|user_)/, '')
    return cachedNotifications.filter((n) => {
      if (n.companyId !== companyId) return false
      const target = String(n.userId || '').toLowerCase().trim()
      const targetClean = target.replace(/^(tech_|user_)/, '')
      return target === uLower || target === uClean || targetClean === uClean
    })
  },
  ['notifications'],
  { revalidate: 15, tags: ['notifications'] }
)
export const listNotifications = cache(async function(companyId: string, userId: string): Promise<AppNotification[]> {
  return listNotificationsCached(companyId, userId)
})

export async function createNotification(
  companyId: string,
  data: Omit<AppNotification, 'id' | 'companyId' | 'createdAt' | 'read'>
): Promise<string> {
  const now = new Date().toISOString()
  const notif: AppNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    companyId,
    createdAt: now,
    read: false,
    ...data,
  }
  try {
    const ref = await adminDb().collection('notifications').add(notif)
    notif.id = ref.id
  } catch (err) {
    console.error('[createNotification] Error:', err)
  }
  cachedNotifications.unshift(notif)
  revalidateTag('notifications')

  // Disparar notificação Push se o utilizador tiver subscrição ativa
  if (data.userId) {
    try {
      const userDoc = await adminDb().collection('users').doc(data.userId).get().catch(() => null)
      const uData = userDoc?.data()
      if (uData?.pushSubscription && (uData.pushSubscription as any).endpoint) {
        await sendWebPush(uData.pushSubscription, {
          title: data.title,
          message: data.body,
          url: data.link || '/dashboard',
        }).catch((pushErr) => {
          console.error('[createNotification sendWebPush] Push delivery error:', pushErr)
        })
      }
    } catch (pushErr) {
      console.error('[createNotification sendWebPush] Error:', pushErr)
    }
  }

  return notif.id
}

export async function markNotificationRead(companyId: string, id: string): Promise<void> {
  try {
    await adminDb().collection('notifications').doc(id).update({ read: true })
  } catch (err) {
    console.error('[markNotificationRead] Error:', err)
  }
  const item = cachedNotifications.find((n) => n.id === id)
  if (item) item.read = true
  revalidateTag('notifications')
}

export async function markAllNotificationsRead(companyId: string, userId: string): Promise<void> {
  const uLower = String(userId || '').toLowerCase().trim()
  const uClean = uLower.replace(/^(tech_|user_)/, '')
  try {
    const snap = await adminDb()
      .collection('notifications')
      .where('companyId', '==', companyId)
      .where('read', '==', false)
      .get()
    const batch = adminDb().batch()
    snap.docs.forEach((doc) => {
      const target = String(doc.data()?.userId || '').toLowerCase().trim()
      const targetClean = target.replace(/^(tech_|user_)/, '')
      if (target === uLower || target === uClean || targetClean === uClean) {
        batch.update(doc.ref, { read: true })
      }
    })
    await batch.commit()
  } catch (err) {
    console.error('[markAllNotificationsRead] Error:', err)
  }
  cachedNotifications.forEach((n) => {
    if (n.companyId === companyId) {
      const target = String(n.userId || '').toLowerCase().trim()
      const targetClean = target.replace(/^(tech_|user_)/, '')
      if (target === uLower || target === uClean || targetClean === uClean) {
        n.read = true
      }
    }
  })
  revalidateTag('notifications')
}

const SEED_INTERNAL_MESSAGES: InternalMessage[] = [
  {
    id: 'msg_seed_1',
    companyId: 'demo_company',
    senderId: 'CUodZKziOwo128GLK66i',
    senderName: 'Rui Garrido',
    senderAbbr: 'RG',
    recipientIds: ['ALL'],
    recipientNames: 'Todos os Técnicos',
    subject: 'Plano de Manutenção e Intervenções Semanais',
    content: 'Bom dia equipa. Por favor verifiquem as OTs pendentes atribuídas para esta semana, dando prioridade às de criticidade alta na Área 80 e Área 30. Bom trabalho a todos.',
    createdAt: '2026-09-08T08:30:00.000Z',
    status: 'info',
    requiresResponse: false,
    readBy: ['CUodZKziOwo128GLK66i', 'mWSsTRtgq5QcOHusTdVYgDVrwHt2', 'MEGjjvqtGqv3Oosxvlrx'],
  },
  {
    id: 'msg_seed_2',
    companyId: 'demo_company',
    senderId: 'MEGjjvqtGqv3Oosxvlrx',
    senderName: 'Leandro Maia',
    senderAbbr: 'LM',
    recipientIds: ['CUodZKziOwo128GLK66i'],
    recipientNames: 'Rui Garrido',
    subject: 'Anomalia no Grupo Hidráulico - Área 80',
    content: 'Detetada vibração excessiva e ruído anormal no grupo hidráulico principal durante a ronda da manhã. Solicito autorização para paragem preventiva de 30 minutos para inspeção.',
    assetTag: 'GH-01',
    assetName: 'Grupo Hidráulico Principal',
    createdAt: '2026-09-09T10:15:00.000Z',
    status: 'replied',
    requiresResponse: true,
    readBy: ['MEGjjvqtGqv3Oosxvlrx', 'CUodZKziOwo128GLK66i'],
  },
  {
    id: 'msg_seed_3',
    companyId: 'demo_company',
    senderId: 'CUodZKziOwo128GLK66i',
    senderName: 'Rui Garrido',
    senderAbbr: 'RG',
    recipientIds: ['MEGjjvqtGqv3Oosxvlrx'],
    recipientNames: 'Leandro Maia',
    subject: 'Re: Anomalia no Grupo Hidráulico - Área 80',
    content: 'Autorizado. Já criei a OT de inspeção corretiva. Podes avançar com a paragem e verificar aperto dos apoios e nível de óleo.',
    replyToId: 'msg_seed_2',
    replyToSubject: 'Anomalia no Grupo Hidráulico - Área 80',
    replyToSender: 'Leandro Maia',
    replyToContent: 'Detetada vibração excessiva e ruído anormal no grupo hidráulico principal...',
    createdAt: '2026-09-09T10:30:00.000Z',
    status: 'info',
    requiresResponse: false,
    readBy: ['CUodZKziOwo128GLK66i', 'MEGjjvqtGqv3Oosxvlrx'],
  },
  {
    id: 'msg_seed_4',
    companyId: 'demo_company',
    senderId: 'mWSsTRtgq5QcOHusTdVYgDVrwHt2',
    senderName: 'RG - RuiG',
    senderAbbr: 'RG',
    recipientIds: ['CUodZKziOwo128GLK66i'],
    recipientNames: 'Gestor / Rui Garrido',
    subject: 'Calibração dos Sensores de Pressão Concluída',
    content: 'Calibração e testes de segurança dos transmissores de pressão da linha de enchimento concluídos com sucesso. Parâmetros dentro das tolerâncias especificadas.',
    assetTag: 'SP-801',
    assetName: 'Sensor de Pressão Linha Enchimento',
    createdAt: '2026-09-09T16:45:00.000Z',
    status: 'closed',
    requiresResponse: false,
    readBy: ['mWSsTRtgq5QcOHusTdVYgDVrwHt2', 'CUodZKziOwo128GLK66i'],
  },
  {
    id: 'msg_seed_5',
    companyId: 'demo_company',
    senderId: 'nAcCSm4E3tNnPLr72UPl',
    senderName: 'Marco Silva',
    senderAbbr: 'MS',
    recipientIds: ['CUodZKziOwo128GLK66i'],
    recipientNames: 'Rui Garrido',
    subject: 'Falta de rolamentos 6205-2RS em stock',
    content: 'Durante a manutenção das bombas centrifugas verificámos que o stock físico de rolamentos 6205-2RS está a zero. É necessário fazer pedido urgente ao fornecedor.',
    createdAt: '2026-09-10T09:00:00.000Z',
    status: 'awaiting_reply',
    requiresResponse: true,
    readBy: ['nAcCSm4E3tNnPLr72UPl'],
  },
]

export const listInternalMessages = cache(async function(
  companyId: string,
  userRefOrId?: any
): Promise<InternalMessage[]> {
  try {
    let docs: InternalMessage[] = []
    try {
      const snap = await adminDb()
        .collection('internal_messages')
        .limit(100)
        .get()
      docs = snap.docs.map((d) => ({ ...serialize<InternalMessage>(d), id: d.id }))
    } catch (dbErr: any) {
      const isQuotaErr = String(dbErr?.message || dbErr).includes('Quota exceeded') || String(dbErr?.message || dbErr).includes('RESOURCE_EXHAUSTED')
      if (isQuotaErr) {
        console.warn('[listInternalMessages] Quota diária do Firestore atingida. A usar mensagens de fallback locais.')
      } else {
        console.error('[listInternalMessages Firestore read error]:', dbErr)
      }
    }

    let deletedIds = new Set<string>()
    try {
      const delSnap = await adminDb().collection('deleted_internal_messages').limit(100).get().catch(() => null)
      if (delSnap && !delSnap.empty) {
        deletedIds = new Set<string>(delSnap.docs.map((d) => d.id))
      }
    } catch { /* ignore */ }

    // Carregar mensagens de fallback persistidas em disco (se existirem)
    let fileMessages: InternalMessage[] = []
    try {
      const filePath = path.join(process.cwd(), 'scripts', 'import', 'messages.json')
      if (fs.existsSync(filePath)) {
        fileMessages = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      }
    } catch {}

    const seen = new Set<string>()
    const allDocs: InternalMessage[] = []
    const rawCandidates = [...docs, ...cachedInternalMessages, ...fileMessages]
    const candidates = rawCandidates.length > 0 ? rawCandidates : SEED_INTERNAL_MESSAGES

    for (const m of candidates) {
      if (m.id && !seen.has(m.id) && !deletedIds.has(m.id)) {
        seen.add(m.id)
        if (!m.companyId || m.companyId === companyId || companyId === DEMO_COMPANY_ID || isDemoCompany(companyId) || isDemoCompany(m.companyId)) {
          allDocs.push(m)
        }
      }
    }
    allDocs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

    if (!userRefOrId) return allDocs

    // Se for gestor ou admin sem filtro específico, acede a todas as mensagens da empresa
    const roleStr = String(userRefOrId?.role || '').toLowerCase().trim()
    const emailStr = String(userRefOrId?.email || '').toLowerCase().trim()
    const isManager =
      roleStr === 'manager' ||
      roleStr === 'admin' ||
      roleStr === 'gestor' ||
      roleStr === 'administrador' ||
      emailStr === 'garrido.rui@gmail.com'

    // Se for gestor puro (sem objeto de técnico), devolve tudo
    if (isManager && !userRefOrId?.forceTechnicianFilter) {
      return allDocs
    }

    // Extrair todos os possíveis tokens do utilizador
    const tokens = new Set<string>()
    const addToken = (val?: string | null) => {
      if (!val) return
      const clean = String(val).trim().toLowerCase()
      if (clean) {
        tokens.add(clean)
        tokens.add(clean.replace(/^(tech_|user_)/, ''))
      }
    }

    if (typeof userRefOrId === 'string') {
      addToken(userRefOrId)
    } else if (typeof userRefOrId === 'object') {
      addToken(userRefOrId.id)
      addToken(userRefOrId.abbreviation)
      addToken(userRefOrId.name)
      addToken(userRefOrId.email)
    }

    // Alias explícito para o técnico RG - RuiG
    if (tokens.has('rg') || tokens.has('ruig') || tokens.has('mwsstrtgq5qcohusdtvygdvrwht2') || tokens.has('tecnico@teste.rg')) {
      tokens.add('rg')
      tokens.add('ruig')
      tokens.add('rg - ruig')
      tokens.add('mwsstrtgq5qcohusdtvygdvrwht2')
      tokens.add('tech_rg')
      tokens.add('tecnico@teste.rg')
    }

    return allDocs.filter((m) => {
      // 1. Mensagens para todos os técnicos
      const recIds = (m.recipientIds || []).map((r) => String(r).toLowerCase().trim())
      if (recIds.includes('all') || (m.recipientNames || '').toLowerCase().includes('todos')) {
        return true
      }

      // 2. Destinatário nos recipientIds
      for (const r of recIds) {
        const cleanR = r.replace(/^(tech_|user_)/, '')
        if (tokens.has(r) || tokens.has(cleanR)) return true
      }

      // 3. Destinatário no recipientNames
      if (m.recipientNames) {
        const rnLower = m.recipientNames.toLowerCase()
        for (const t of Array.from(tokens)) {
          if (t.length >= 2 && rnLower.includes(t)) return true
        }
      }

      // 4. Remetente é o próprio utilizador (mensagens enviadas por ele)
      if (m.senderId) {
        const sLower = String(m.senderId).toLowerCase().trim()
        const sClean = sLower.replace(/^(tech_|user_)/, '')
        if (tokens.has(sLower) || tokens.has(sClean)) return true
      }
      if (m.senderAbbr && tokens.has(String(m.senderAbbr).toLowerCase().trim())) return true
      if (m.senderName) {
        const snLower = m.senderName.toLowerCase()
        for (const t of Array.from(tokens)) {
          if (t.length >= 3 && snLower.includes(t)) return true
        }
      }

      return false
    })
  } catch (err) {
    console.error('[listInternalMessages] Error:', err)
  }
  return cachedInternalMessages
})

export async function createInternalMessage(
  companyId: string,
  senderId: string,
  data: Omit<InternalMessage, 'id' | 'companyId' | 'senderId' | 'createdAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const finalCompanyId = companyId || DEMO_COMPANY_ID
  const generatedId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const msgObj: InternalMessage = {
    id: generatedId,
    companyId: finalCompanyId,
    senderId,
    createdAt: now,
    readBy: [senderId],
    status: data.status || (data.requiresResponse ? 'awaiting_reply' : 'info'),
    ...data,
  }
  
  // Limpa campos undefined para o Firestore aceitar a gravação sem erros
  const sanitizedObj = JSON.parse(JSON.stringify(msgObj))
  
  try {
    const ref = await adminDb().collection('internal_messages').add(sanitizedObj)
    msgObj.id = ref.id
  } catch (err) {
    console.error('[createInternalMessage Firestore error]:', err)
  }
  cachedInternalMessages.unshift(msgObj)

  try {
    const filePath = path.join(process.cwd(), 'scripts', 'import', 'messages.json')
    let current: InternalMessage[] = []
    if (fs.existsSync(filePath)) {
      current = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
    current.unshift(msgObj)
    fs.writeFileSync(filePath, JSON.stringify(current.slice(0, 100), null, 2))
  } catch { /* read-only fs */ }

  revalidateTag('messages')

  // Se esta mensagem é uma resposta a outra, atualizar o estado da mensagem original para 'replied'
  if (data.replyToId) {
    try {
      const origMsg = cachedInternalMessages.find((m) => m.id === data.replyToId)
      if (origMsg) {
        origMsg.status = 'replied'
      }
      await adminDb()
        .collection('internal_messages')
        .doc(data.replyToId)
        .update({ status: 'replied', updatedAt: now })
        .catch(() => {})
    } catch (err) {
      console.error('[createInternalMessage reply status update] Error:', err)
    }
  }

  // Disparar notificações em background para não bloquear a resposta do servidor nem tornar o envio lento
  void (async () => {
    try {
      const companyUsers = getFallbackUsers()

      const targetUserIds = new Set<string>()
      if (data.recipientIds.includes('ALL')) {
        companyUsers.forEach((u) => { if (u.id !== senderId) targetUserIds.add(u.id) })
      } else {
        data.recipientIds.forEach((rec) => {
          const recClean = String(rec).toLowerCase().trim().replace(/^(tech_|user_)/, '')
          // Mapeamento especial de RG
          if (recClean === 'rg' || recClean === 'ruig' || recClean === 'mwsstrtgq5qcohusdtvygdvrwht2') {
            targetUserIds.add('mWSsTRtgq5QcOHusTdVYgDVrwHt2')
          }
          companyUsers.forEach((u) => {
            const uAbbr = String(u.abbreviation || '').toLowerCase().trim()
            const uName = String(u.name || '').toLowerCase().trim()
            const uId = String(u.id || '').toLowerCase().trim().replace(/^(tech_|user_)/, '')
            if (
              u.id !== senderId &&
              (uId === recClean ||
               uAbbr === recClean ||
               uName === recClean ||
               recClean.includes(uAbbr) ||
               recClean.includes(uName))
            ) {
              targetUserIds.add(u.id)
            }
          })
        })
      }

      const notifTitle = data.replyToId
        ? `↩️ Resposta de ${data.senderName}`
        : (data.requiresResponse || data.status === 'awaiting_reply'
            ? `⏳ Mensagem (Aguarda Resposta) de ${data.senderName}`
            : `💬 Nova Mensagem de ${data.senderName}`)

      await Promise.allSettled(
        Array.from(targetUserIds).map((uId) =>
          createNotification(companyId, {
            userId: uId,
            title: notifTitle,
            body: data.content.slice(0, 80) + (data.content.length > 80 ? '...' : ''),
            type: 'internal_message',
            link: '/dashboard/messages',
            senderName: data.senderName,
            senderAbbr: data.senderAbbr,
          })
        )
      )
    } catch (err) {
      console.error('[createInternalMessage notifications] Error:', err)
    }
  })()

  return msgObj.id
}

export async function updateInternalMessageStatus(
  companyId: string,
  messageId: string,
  status: MessageStatus
): Promise<void> {
  const now = new Date().toISOString()
  try {
    const orig = cachedInternalMessages.find((m) => m.id === messageId)
    if (orig) {
      orig.status = status
    }
    await adminDb()
      .collection('internal_messages')
      .doc(messageId)
      .update({ status, updatedAt: now })
  } catch (err) {
    console.error('[updateInternalMessageStatus] Error:', err)
  }
  revalidateTag('messages')
}

export async function deleteInternalMessage(
  companyId: string,
  messageId: string
): Promise<void> {
  const finalCompanyId = companyId || DEMO_COMPANY_ID
  cachedInternalMessages = cachedInternalMessages.filter((m) => m.id !== messageId)
  try {
    await adminDb().collection('internal_messages').doc(messageId).delete().catch(() => {})
    await adminDb().collection('deleted_internal_messages').doc(messageId).set({
      deletedAt: new Date().toISOString(),
      companyId: finalCompanyId,
    }).catch(() => {})
  } catch (err) {
    console.error('[deleteInternalMessage] Error:', err)
  }
  revalidateTag('messages')
}



