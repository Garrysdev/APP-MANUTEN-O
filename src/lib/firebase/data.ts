// Acesso a dados (servidor) via Admin SDK. Todas as queries são scoped por companyId.
import 'server-only'
import { cache } from 'react'
import { unstable_cache, revalidateTag } from 'next/cache'
import fs from 'fs'
import path from 'path'
import type { DocumentSnapshot } from 'firebase-admin/firestore'
import { adminDb, adminAuth } from './admin'
import { sendTaskAssignedEmail, sendUrgentTaskEmail } from '../notifications'
import { calculateTotalCost } from '../finance'
import { DEFAULT_TECHNICIAN_TYPES, type Asset, type Task, type User, type ExternalCompany, type Intervention, type Material, type Invite, type UserRole, type MaintenancePlan, type StockItem, type StockMovement, type TaskCriticidade, type Periodicidade, type Executor, type SafetyRule, type AppNotification, type InternalMessage } from '@/types/models'

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
        completedAt: item.completedAt || null,
        dueDate: item.dueDate || item.plannedStartDate || null,
        assignedTo: item.assignedTo || null,
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
  const techs = [
    { id: 'tech_LM', name: 'Leandro M. (LM)', abbreviation: 'LM', email: 'lm@rgmaintenance.pt', role: 'technician', active: true, isExternal: false },
    { id: 'tech_RG', name: 'Rui Garrido (RG)', abbreviation: 'RG', email: 'garrido.rui@gmail.com', role: 'manager', active: true, isExternal: false },
    { id: 'tech_MarcoSilva', name: 'Marco Silva (MS)', abbreviation: 'MS', email: 'tecnico@teste.rg', role: 'technician', active: true, isExternal: false },
    { id: 'tech_LI', name: 'Luís I. (LI)', abbreviation: 'LI', email: 'li@rgmaintenance.pt', role: 'technician', active: true, isExternal: false },
    { id: 'tech_MC', name: 'Manuel C. (MC)', abbreviation: 'MC', email: 'mc@rgmaintenance.pt', role: 'technician', active: true, isExternal: false },
    { id: 'tech_JC', name: 'João C. (JC)', abbreviation: 'JC', email: 'jc@rgmaintenance.pt', role: 'technician', active: true, isExternal: false },
    { id: 'tech_MS', name: 'Mário S. (MS)', abbreviation: 'MS', email: 'ms@rgmaintenance.pt', role: 'technician', active: true, isExternal: false },
    { id: 'tech_CB', name: 'Carlos B. (CB)', abbreviation: 'CB', email: 'cb@rgmaintenance.pt', role: 'technician', active: true, isExternal: false },
    { id: 'tech_UR', name: 'Técnico UR (UR)', abbreviation: 'UR', email: 'ur@rgmaintenance.pt', role: 'technician', active: true, isExternal: false },
    { id: 'tech_OX2', name: 'Eng. Pedro (OX2)', abbreviation: 'OX2', email: 'ox2@rgmaintenance.pt', role: 'technician', active: true, isExternal: true, externalCompanyId: 'comp_ox2', externalCompanyName: 'OX2 Especialista', specialty: 'Caldeiras & Sobreasquecimento', phone: '912 345 678' },
    { id: 'tech_BlockControl', name: 'Nuno / João (BlockControl)', abbreviation: 'BLK', email: 'blockcontrol@rgmaintenance.pt', role: 'technician', active: true, isExternal: true, externalCompanyId: 'comp_blk', externalCompanyName: 'BlockControl Automação', specialty: 'Automação & Eletrónica', phone: '934 567 890' },
    { id: 'tech_Carrier', name: 'Ricardo (Carrier)', abbreviation: 'CAR', email: 'carrier@rgmaintenance.pt', role: 'technician', active: true, isExternal: true, externalCompanyId: 'comp_car', externalCompanyName: 'Carrier Portugal', specialty: 'HVAC / Climatização', phone: '965 432 109' },
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
export const listAssets = cache(async function(companyId: string, limitCount = 2000): Promise<Asset[]> {
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
})

/** Versão LEVE: id + name + tag (para dropdowns e mapa id→nome/tag). */
export const listAssetRefs = cache(async function(companyId: string): Promise<{ id: string; name: string; tag?: string | null; area?: string | null }[]> {
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
export const listTasks = cache(async function(companyId: string, limitCount = 2000): Promise<Task[]> {
  try {
    const snap = await adminDb()
      .collection('tasks')
      .where('companyId', '==', companyId)
      .limit(limitCount)
      .get()
    const dbDocs = snap.docs.map((d) => serialize<Task>(d))
    if (!isDemoCompany(companyId)) {
      return dbDocs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    }
    const fallbacks = getFallbackTasks()
    if (dbDocs.length === 0) return fallbacks

    const dbMap = new Map(dbDocs.map((d) => [d.id, d]))
    const mergedFallbacks = fallbacks.map((f) => dbMap.get(f.id) || f)
    const customDocs = dbDocs.filter((d) => !fallbacks.some((f) => f.id === d.id))
    return [...customDocs, ...mergedFallbacks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  } catch (err) {
    console.error('[listTasks] Error:', err)
  }
  return isDemoCompany(companyId) ? getFallbackTasks() : []
})

export const listTasksByAsset = cache(async function(companyId: string, assetId: string, providedAssetTag?: string | null): Promise<Task[]> {
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
        .limit(100)
        .get()
        .catch(() => ({ docs: [] }))
    ]

    if (assetTag && assetTag !== assetId) {
      queries.push(
        adminDb()
          .collection('tasks')
          .where('companyId', '==', companyId)
          .where('tag', '==', assetTag)
          .limit(100)
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

    if (!isDemoCompany(companyId)) {
      return dbDocs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    }

    const fallbacks = getFallbackTasks().filter((t) => t.assetId === assetId || (assetTag && t.tag === assetTag))
    const merged = Array.from(new Map([...dbDocs, ...fallbacks].map((t) => [t.id, t])).values())
    if (merged.length > 0) {
      return merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    }
  } catch (err) {
    console.error('[listTasksByAsset] Error:', err)
  }
  return isDemoCompany(companyId) ? getFallbackTasks().filter((t) => t.assetId === assetId) : []
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
    const ref = await adminDb()
      .collection('tasks')
      .add({ createdAt: now, updatedAt: now, ...data, companyId, createdBy })
    generatedId = ref.id

    // NOTIFICAÇÕES PARA TÉCNICOS ATRIBUÍDOS
    const techIdsToNotify = new Set<string>()
    if (data.assignedToIds && Array.isArray(data.assignedToIds)) {
      data.assignedToIds.forEach((id) => { if (id && id !== createdBy) techIdsToNotify.add(id) })
    }
    if (techIdsToNotify.size === 0 && data.assignedTo) {
      try {
        const allUsersSnap = await adminDb().collection('users').where('companyId', '==', companyId).get()
        allUsersSnap.docs.forEach((d) => {
          const u = d.data() as User
          if (
            d.id !== createdBy &&
            (d.id === data.assignedTo || u.abbreviation === data.assignedTo || u.name === data.assignedTo)
          ) {
            techIdsToNotify.add(d.id)
          }
        })
      } catch (err) {
        console.error('[createTask notify users] Error:', err)
      }
    }

    for (const techId of techIdsToNotify) {
      await createNotification(companyId, {
        userId: techId,
        title: `📋 Nova OT Atribuída: ${data.title}`,
        body: `Foi-lhe atribuída uma nova OT na Área ${data.area || 'Geral'} (TAG: ${data.tag || '—'})`,
        type: 'task_assigned',
        link: `/dashboard/tasks/${generatedId}`,
        senderName: data.createdByName || 'Gestor',
      }).catch(console.error)
    }

    if (data.criticidade === 'vermelho' || data.tipo === 'curativa') {
      await sendUrgentTaskEmail({ id: generatedId, title: data.title, companyId }).catch(() => {})
    }
  } catch (err) {
    console.error('Erro em createTask:', err)
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
    await ref.set(
      {
        id,
        companyId,
        createdAt: now,
        updatedAt: now,
        status: 'pending',
        tipo: 'plano',
        criticidade: 'verde',
        ...data,
      },
      { merge: true }
    )
  } else {
    await ref.update({ ...data, updatedAt: now })
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
      const snap = await adminDb()
        .collection('users')
        .where('companyId', '==', companyId)
        .get()
      const dbDocs = snap.docs.map((d) => serialize<User>(d))

      let deletedIds = new Set<string>()
      let deletedEmails = new Set<string>()
      let deletedAbbrs = new Set<string>()
      try {
        const delSnap = await adminDb().collection('deleted_users').get()
        delSnap.docs.forEach((d) => {
          deletedIds.add(d.id)
          const data = d.data()
          if (data?.email) deletedEmails.add(String(data.email).toLowerCase())
          if (data?.abbreviation) deletedAbbrs.add(String(data.abbreviation).toUpperCase())
        })
      } catch { /* ignore */ }

      const isDeleted = (u: { id: string; email?: string | null; abbreviation?: string | null; active?: boolean }) => {
        if (u.active === false) return true
        if (deletedIds.has(u.id)) return true
        if (u.email && deletedEmails.has(u.email.toLowerCase())) return true
        if (u.abbreviation && deletedAbbrs.has(u.abbreviation.toUpperCase())) return true
        return false
      }

      const validDbDocs = dbDocs.filter((d) => !isDeleted(d))

      if (validDbDocs.length > 0 || !isDemoCompany(companyId)) {
        return validDbDocs
      }

      const fallbacks = getFallbackUsers().filter((f) => !isDeleted(f))
      return fallbacks
    } catch (err) {
      console.error('[listUsers] Error:', err)
    }
    return isDemoCompany(companyId) ? getFallbackUsers().filter((f) => f.active !== false) : []
  },
  ['users'],
  { revalidate: 60, tags: ['users'] }
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
  }
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
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

  await adminDb().collection('users').doc(userId).set(update, { merge: true })
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

export const listMaintenancePlans = cache(async function(companyId: string): Promise<MaintenancePlan[]> {
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
    console.error('[createStockItem] Error:', err)
    return `stock_${Date.now()}`
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
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
      const docs = snap.docs.map((d) => serialize<AppNotification>(d))
      if (docs.length > 0) return docs
    } catch (err) {
      console.error('[listNotifications] Error:', err)
    }
    return cachedNotifications.filter((n) => n.companyId === companyId && n.userId === userId)
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
  try {
    const snap = await adminDb()
      .collection('notifications')
      .where('companyId', '==', companyId)
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get()
    const batch = adminDb().batch()
    snap.docs.forEach((doc) => batch.update(doc.ref, { read: true }))
    await batch.commit()
  } catch (err) {
    console.error('[markAllNotificationsRead] Error:', err)
  }
  cachedNotifications.forEach((n) => {
    if (n.companyId === companyId && n.userId === userId) n.read = true
  })
  revalidateTag('notifications')
}

export const listInternalMessages = cache(async function(companyId: string, userId?: string): Promise<InternalMessage[]> {
  try {
    const snap = await adminDb()
      .collection('internal_messages')
      .get()
    const docs = snap.docs
      .map((d) => ({ ...serialize<InternalMessage>(d), id: d.id }))
      .filter((m) => !m.companyId || m.companyId === companyId || companyId === DEMO_COMPANY_ID)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

    if (!userId) return docs
    return docs.filter(
      (m) =>
        m.senderId === userId ||
        (m.recipientIds || []).includes(userId) ||
        (m.recipientIds || []).includes('ALL')
    )
  } catch (err) {
    console.error('[listInternalMessages] Error:', err)
  }
  return cachedInternalMessages.filter(
    (m) =>
      (!m.companyId || m.companyId === companyId) &&
      (!userId || m.senderId === userId || (m.recipientIds || []).includes(userId) || (m.recipientIds || []).includes('ALL'))
  )
})

export async function createInternalMessage(
  companyId: string,
  senderId: string,
  data: Omit<InternalMessage, 'id' | 'companyId' | 'senderId' | 'createdAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const msgObj: InternalMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    companyId,
    senderId,
    createdAt: now,
    readBy: [senderId],
    ...data,
  }
  
  // Limpa campos undefined para o Firestore aceitar a gravação sem erros
  const sanitizedObj = JSON.parse(JSON.stringify(msgObj))
  
  try {
    const ref = await adminDb().collection('internal_messages').add(sanitizedObj)
    msgObj.id = ref.id
  } catch (err) {
    console.error('[createInternalMessage] Error:', err)
  }
  cachedInternalMessages.unshift(msgObj)

  try {
    const allUsersSnap = await adminDb().collection('users').get()
    const companyUsers = allUsersSnap.docs.map((d) => serialize<User>(d))

    const targetUserIds = new Set<string>()
    if (data.recipientIds.includes('ALL')) {
      companyUsers.forEach((u) => { if (u.id !== senderId) targetUserIds.add(u.id) })
    } else {
      data.recipientIds.forEach((rec) => {
        companyUsers.forEach((u) => {
          if (u.id !== senderId && (u.id === rec || u.abbreviation === rec || u.name === rec)) {
            targetUserIds.add(u.id)
          }
        })
      })
    }

    for (const uId of Array.from(targetUserIds)) {
      await createNotification(companyId, {
        userId: uId,
        title: `💬 Nova Mensagem de ${data.senderName}`,
        body: data.content.slice(0, 80) + (data.content.length > 80 ? '...' : ''),
        type: 'internal_message',
        link: '/dashboard/messages',
        senderName: data.senderName,
        senderAbbr: data.senderAbbr,
      }).catch(console.error)
    }
  } catch (err) {
    console.error('[createInternalMessage notifications] Error:', err)
  }

  return msgObj.id
}
