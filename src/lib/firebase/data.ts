// Acesso a dados (servidor) via Admin SDK. Todas as queries são scoped por companyId.
import 'server-only'
import { cache } from 'react'
import fs from 'fs'
import path from 'path'
import type { DocumentSnapshot } from 'firebase-admin/firestore'
import { adminDb, adminAuth } from './admin'
import { sendTaskAssignedEmail, sendUrgentTaskEmail } from '../notifications'
import { calculateTotalCost } from '../finance'
import { DEFAULT_TECHNICIAN_TYPES, type Asset, type Task, type User, type Intervention, type Material, type Invite, type UserRole, type MaintenancePlan, type StockItem, type StockMovement, type TaskCriticidade, type Periodicidade, type Executor } from '@/types/models'

function serialize<T>(doc: DocumentSnapshot): T {
  return { id: doc.id, ...doc.data() } as T
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
        criticidade: item.criticidade || 'verde',
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
    const filePathUr = path.join(process.cwd(), 'scripts', 'import', 'tasks_ur.json')
    const filePathPr = path.join(process.cwd(), 'scripts', 'import', 'tasks_projects.json')
    let tasks: Task[] = []
    
    if (fs.existsSync(filePathUr)) {
      const raw = fs.readFileSync(filePathUr, 'utf-8')
      const json = JSON.parse(raw)
      const listUr = json.map((item: any, idx: number) => ({
        id: item.sourceId || `task_ur_${idx + 1}`,
        companyId: 'rjHNaSUbLm4qTMyKP0oX',
        title: item.title || 'Ordem de Trabalho',
        description: item.title || null,
        area: item.area || null,
        tag: item.tag || null,
        tipo: item.tipo || 'curativa',
        assignedTo: item.technicians || null,
        status: item.status === 'done' ? 'done' : (item.status === 'in_progress' ? 'in_progress' : 'pending'),
        source: 'folha_ur_historico',
        createdBy: 'system',
        createdAt: new Date(Date.now() - (idx * 3600000)).toISOString(),
        updatedAt: new Date().toISOString()
      }))
      tasks = tasks.concat(listUr)
    }

    if (fs.existsSync(filePathPr)) {
      const raw = fs.readFileSync(filePathPr, 'utf-8')
      const json = JSON.parse(raw)
      const listPr = json.map((item: any, idx: number) => ({
        id: `task_proj_${idx + 1}`,
        companyId: 'rjHNaSUbLm4qTMyKP0oX',
        title: item.title || item.name || 'Tarefa de Projeto',
        description: item.description || null,
        area: item.area || null,
        tag: item.tag || null,
        tipo: item.tipo || 'curativa',
        status: item.status || 'pending',
        source: 'folha_projetos',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
      tasks = tasks.concat(listPr)
    }

    cachedFallbackTasks = tasks
    return cachedFallbackTasks
  } catch (err) {
    console.error('[Fallback] Error loading tasks JSON:', err)
  }
  return []
}

let cachedFallbackUsers: User[] | null = null
function getFallbackUsers(): User[] {
  if (cachedFallbackUsers) return cachedFallbackUsers
  const techs = [
    { id: 'tech_LM', name: 'Leandro M. (LM)', abbreviation: 'LM', email: 'lm@rgmaintenance.pt', role: 'technician' },
    { id: 'tech_RG', name: 'Rui Garrido (RG)', abbreviation: 'RG', email: 'garrido.rui@gmail.com', role: 'manager' },
    { id: 'tech_LI', name: 'Luís I. (LI)', abbreviation: 'LI', email: 'li@rgmaintenance.pt', role: 'technician' },
    { id: 'tech_MC', name: 'Manuel C. (MC)', abbreviation: 'MC', email: 'mc@rgmaintenance.pt', role: 'technician' },
    { id: 'tech_JC', name: 'João C. (JC)', abbreviation: 'JC', email: 'jc@rgmaintenance.pt', role: 'technician' },
    { id: 'tech_MS', name: 'Mário S. (MS)', abbreviation: 'MS', email: 'ms@rgmaintenance.pt', role: 'technician' },
    { id: 'tech_CB', name: 'Carlos B. (CB)', abbreviation: 'CB', email: 'cb@rgmaintenance.pt', role: 'technician' },
    { id: 'tech_OX2', name: 'OX2 Especialista', abbreviation: 'OX2', email: 'ox2@rgmaintenance.pt', role: 'technician' },
    { id: 'tech_BlockControl', name: 'BlockControl (Nuno/João)', abbreviation: 'BLK', email: 'blockcontrol@rgmaintenance.pt', role: 'technician' },
    { id: 'tech_Carrier', name: 'Carrier (Ricardo)', abbreviation: 'CAR', email: 'carrier@rgmaintenance.pt', role: 'technician' },
    { id: 'tech_Schindler', name: 'Schindler', abbreviation: 'SCH', email: 'schindler@rgmaintenance.pt', role: 'technician' },
    { id: 'tech_Helenos', name: 'Helenos', abbreviation: 'HEL', email: 'helenos@rgmaintenance.pt', role: 'technician' }
  ]
  cachedFallbackUsers = techs.map(t => ({
    ...t,
    companyId: 'rjHNaSUbLm4qTMyKP0oX',
    active: true,
    createdAt: new Date().toISOString()
  })) as User[]
  return cachedFallbackUsers
}

// ── ASSETS ──────────────────────────────────────────────────────────────────
export const listAssets = cache(async function(companyId: string): Promise<Asset[]> {
  try {
    const snap = await adminDb()
      .collection('assets')
      .where('companyId', '==', companyId)
      .get()
    const docs = snap.docs.map((d) => serialize<Asset>(d))
    if (docs.length > 0) return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch (err) {
    console.error('[listAssets] Error / Quota Exceeded:', err)
  }
  return getFallbackAssets()
})

/** Versão LEVE: id + name + tag (para dropdowns e mapa id→nome/tag). */
export const listAssetRefs = cache(async function(companyId: string): Promise<{ id: string; name: string; tag?: string | null }[]> {
  try {
    const snap = await adminDb()
      .collection('assets')
      .where('companyId', '==', companyId)
      .select('name', 'tag')
      .get()
    const docs = snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) ?? '', tag: (d.data().tag as string) ?? null }))
    if (docs.length > 0) return docs.sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    console.error('[listAssetRefs] Error / Quota Exceeded:', err)
  }
  return getFallbackAssets().map(a => ({ id: a.id, name: a.name, tag: a.tag }))
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
  const doc = await adminDb().collection('assets').doc(id).get()
  if (!doc.exists || doc.data()?.companyId !== companyId) return null
  return serialize<Asset>(doc)
})

export async function createAsset(
  companyId: string,
  data: Omit<Asset, 'id' | 'companyId' | 'createdAt'>
): Promise<string> {
  const ref = await adminDb()
    .collection('assets')
    .add({ ...data, companyId, createdAt: new Date().toISOString() })
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
}

export async function deleteAsset(companyId: string, id: string): Promise<void> {
  const ref = adminDb().collection('assets').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Ativo não encontrado')
  await ref.delete()
}

// ── TASKS ───────────────────────────────────────────────────────────────────
export const listTasks = cache(async function(companyId: string): Promise<Task[]> {
  try {
    const snap = await adminDb()
      .collection('tasks')
      .where('companyId', '==', companyId)
      .get()
    const docs = snap.docs.map((d) => serialize<Task>(d))
    if (docs.length > 0) return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch (err) {
    console.error('[listTasks] Error / Quota Exceeded:', err)
  }
  return getFallbackTasks()
})

export const listTasksByAsset = cache(async function(companyId: string, assetId: string): Promise<Task[]> {
  try {
    const snap = await adminDb()
      .collection('tasks')
      .where('companyId', '==', companyId)
      .where('assetId', '==', assetId)
      .get()
    const docs = snap.docs.map((d) => serialize<Task>(d))
    if (docs.length > 0) return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch (err) {
    console.error('[listTasksByAsset] Error / Quota Exceeded:', err)
  }
  return getFallbackTasks().filter(t => t.assetId === assetId)
})

export const getTask = cache(async function(companyId: string, id: string): Promise<Task | null> {
  try {
    const doc = await adminDb().collection('tasks').doc(id).get()
    if (doc.exists && doc.data()?.companyId === companyId) {
      return serialize<Task>(doc)
    }
  } catch (err) {
    console.error('[getTask] Error / Quota Exceeded:', err)
  }
  return getFallbackTasks().find(t => t.id === id) || null
})

export async function createTask(
  companyId: string,
  createdBy: string,
  data: Omit<Task, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>
): Promise<string> {
  const now = new Date().toISOString()
  const ref = await adminDb()
    .collection('tasks')
    .add({ ...data, companyId, createdBy, createdAt: now, updatedAt: now })
    
  // NOTIFICAÇÕES (MOCK)
  try {
    if (data.assignedTo) {
      const uSnap = await adminDb().collection('users').doc(data.assignedTo).get()
      if (uSnap.exists) {
        const uData = uSnap.data() as User
        await sendTaskAssignedEmail(
          { name: uData.name, email: uData.email, pushSubscription: uData.pushSubscription },
          { id: ref.id, title: data.title }
        )
      }
    }
    if (data.criticidade === 'vermelho' || data.tipo === 'curativa') {
      await sendUrgentTaskEmail({ id: ref.id, title: data.title, companyId })
    }
  } catch (err) {
    console.error('Erro ao enviar notificação mock:', err)
  }

  return ref.id
}

export async function updateTask(
  companyId: string,
  id: string,
  data: Partial<Omit<Task, 'id' | 'companyId' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  const ref = adminDb().collection('tasks').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Tarefa não encontrada')
  await ref.update({ ...data, updatedAt: new Date().toISOString() })
}

export async function deleteTask(companyId: string, id: string): Promise<void> {
  const ref = adminDb().collection('tasks').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Tarefa não encontrada')
  await ref.delete()
}

// ── USERS (para atribuição de tarefas) ────────────────────────────────────────
export const listUsers = cache(async function(companyId: string): Promise<User[]> {
  try {
    const snap = await adminDb()
      .collection('users')
      .where('companyId', '==', companyId)
      .get()
    const docs = snap.docs.map((d) => serialize<User>(d))
    if (docs.length > 0) return docs
  } catch (err) {
    console.error('[listUsers] Error / Quota Exceeded:', err)
  }
  return getFallbackUsers()
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
}

export async function deactivateUser(companyId: string, userId: string): Promise<void> {
  const ref = adminDb().collection('users').doc(userId)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId)
    throw new Error('Utilizador não encontrado')
  await ref.update({ active: false })
  // Bloqueia a conta Firebase Auth e revoga todos os tokens
  await adminAuth().updateUser(userId, { disabled: true })
  await adminAuth().revokeRefreshTokens(userId)
}

export async function updateUserRate(companyId: string, userId: string, hourlyRate: number): Promise<void> {
  const ref = adminDb().collection('users').doc(userId)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Utilizador não encontrado.')
  await ref.update({ hourlyRate })
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
  data: { email: string; name: string; role: UserRole; tempPassword: string; avatarUrl?: string | null; specialty?: string | null; abbreviation?: string | null }
): Promise<string> {
  const authUser = await adminAuth().createUser({
    email: data.email,
    password: data.tempPassword,
    displayName: data.name,
  })
  await adminDb().collection('users').doc(authUser.uid).set({
    companyId,
    email: data.email,
    name: data.name.trim(),
    abbreviation: data.abbreviation ? data.abbreviation.trim().toUpperCase() : null,
    role: data.role,
    avatarUrl: data.avatarUrl ?? null,
    specialty: data.specialty ?? null,
    active: true,
    createdAt: new Date().toISOString(),
  })
  return authUser.uid
}

export async function updateUserProfile(
  userId: string,
  data: { name?: string; avatarUrl?: string | null; language?: string; specialty?: string | null; role?: UserRole; abbreviation?: string | null }
): Promise<void> {
  const update: Record<string, unknown> = {}
  if (data.name !== undefined) update.name = data.name.trim()
  if (data.abbreviation !== undefined) update.abbreviation = data.abbreviation ? data.abbreviation.trim().toUpperCase() : null
  if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl
  if (data.language !== undefined) update.language = data.language
  if (data.specialty !== undefined) update.specialty = data.specialty
  if (data.role !== undefined) update.role = data.role
  await adminDb().collection('users').doc(userId).update(update)
}

export const countActiveUsers = cache(async function(companyId: string): Promise<number> {
  const users = await listUsers(companyId)
  return users.filter((u) => u.active).length
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
  return all.filter((i) => i.technicianId === technicianId)
})

// ── MAINTENANCE PLANS ─────────────────────────────────────────────────────────

export const listMaintenancePlans = cache(async function(companyId: string): Promise<MaintenancePlan[]> {
  try {
    const snap = await adminDb()
      .collection('maintenance_plans')
      .where('companyId', '==', companyId)
      .get()
    const docs = snap.docs.map((d) => serialize<MaintenancePlan>(d))
    if (docs.length > 0) return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch (err) {
    console.error('[listMaintenancePlans] Error / Quota Exceeded:', err)
  }
  return getFallbackPlans()
})

export const getMaintenancePlan = cache(async function(companyId: string, id: string): Promise<MaintenancePlan | null> {
  try {
    const doc = await adminDb().collection('maintenance_plans').doc(id).get()
    if (doc.exists && doc.data()?.companyId === companyId) {
      return serialize<MaintenancePlan>(doc)
    }
  } catch (err) {
    console.error('[getMaintenancePlan] Error / Quota Exceeded:', err)
  }
  return getFallbackPlans().find(p => p.id === id) || null
})

export async function createMaintenancePlan(
  companyId: string,
  createdBy: string,
  data: Omit<MaintenancePlan, 'id' | 'companyId' | 'createdBy' | 'createdAt' | 'updatedAt' | 'lastGeneratedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const ref = await adminDb()
    .collection('maintenance_plans')
    .add({ ...data, companyId, createdBy, createdAt: now, updatedAt: now, lastGeneratedAt: null })
  return ref.id
}

export async function updateMaintenancePlan(
  companyId: string,
  id: string,
  data: Partial<Omit<MaintenancePlan, 'id' | 'companyId' | 'createdBy' | 'createdAt'>>
): Promise<void> {
  const ref = adminDb().collection('maintenance_plans').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Plano não encontrado')
  await ref.update({ ...data, updatedAt: new Date().toISOString() })
}

export async function deleteMaintenancePlan(companyId: string, id: string): Promise<void> {
  const ref = adminDb().collection('maintenance_plans').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Plano não encontrado')
  await ref.delete()
}

export const getUsersByCompany = cache(async function(companyId: string): Promise<User[]> {
  return listUsers(companyId)
})

// ── STOCK ITEMS ───────────────────────────────────────────────────────────────

export const listStockItems = cache(async function(companyId: string): Promise<StockItem[]> {
  try {
    const snap = await adminDb()
      .collection('stock_items')
      .where('companyId', '==', companyId)
      .get()
    return snap.docs
      .map((d) => serialize<StockItem>(d))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    console.error('[listStockItems] Error:', err)
    return []
  }
})

export const getStockItem = cache(async function(companyId: string, id: string): Promise<StockItem | null> {
  const snap = await adminDb().collection('stock_items').doc(id).get()
  if (!snap.exists || snap.data()?.companyId !== companyId) return null
  return serialize<StockItem>(snap)
})

export async function createStockItem(
  companyId: string,
  data: Omit<StockItem, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const ref = await adminDb()
    .collection('stock_items')
    .add({ ...data, companyId, createdAt: now, updatedAt: now })
  return ref.id
}

export async function updateStockItem(
  companyId: string,
  id: string,
  data: Partial<Omit<StockItem, 'id' | 'companyId' | 'createdAt'>>
): Promise<void> {
  const ref = adminDb().collection('stock_items').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Item não encontrado')
  await ref.update({ ...data, updatedAt: new Date().toISOString() })
}

export async function deleteStockItem(companyId: string, id: string): Promise<void> {
  const ref = adminDb().collection('stock_items').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) throw new Error('Item não encontrado')
  await ref.delete()
}

export async function decrementStockQuantity(
  companyId: string,
  id: string,
  qty: number
): Promise<void> {
  const { FieldValue } = await import('firebase-admin/firestore')
  const ref = adminDb().collection('stock_items').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) return
  await ref.update({
    quantity: FieldValue.increment(-qty),
    updatedAt: new Date().toISOString(),
  })
}

export async function incrementStockQuantity(
  companyId: string,
  id: string,
  qty: number
): Promise<void> {
  const { FieldValue } = await import('firebase-admin/firestore')
  const ref = adminDb().collection('stock_items').doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data()?.companyId !== companyId) return
  await ref.update({
    quantity: FieldValue.increment(qty),
    updatedAt: new Date().toISOString(),
  })
}

export async function createStockMovement(
  companyId: string,
  createdBy: string,
  data: Omit<StockMovement, 'id' | 'companyId' | 'createdBy' | 'createdAt'>
): Promise<string> {
  const now = new Date().toISOString()
  const ref = await adminDb().collection('stock_movements').add({
    ...data,
    companyId,
    createdBy,
    createdAt: now,
  })
  return ref.id
}

export const listStockMovements = cache(async function(
  companyId: string,
  stockItemId: string
): Promise<StockMovement[]> {
  const snap = await adminDb()
    .collection('stock_movements')
    .where('companyId', '==', companyId)
    .where('stockItemId', '==', stockItemId)
    .get()
  return snap.docs
    .map((d) => serialize<StockMovement>(d))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

export const listMaterialsByName = cache(async function(companyId: string, name: string): Promise<Material[]> {
  const snap = await adminDb()
    .collection('materials')
    .where('companyId', '==', companyId)
    .where('name', '==', name)
    .get()
  return snap.docs
    .map((d) => serialize<Material>(d))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

export async function calculateTaskCost(companyId: string, taskId: string): Promise<void> {
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
}
