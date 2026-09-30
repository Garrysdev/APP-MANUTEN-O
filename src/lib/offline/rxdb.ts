'use client'

/**
 * Base de dados local (RxDB/IndexedDB) do técnico — Fase 1. Espelha só o que um técnico
 * precisa para trabalhar sem rede: as OTs atribuídas a ele, os equipamentos/regras de
 * segurança de referência, e as intervenções que ele próprio cria (aqui ou offline).
 *
 * Nunca é usada por ecrãs de gestor — ver src/hooks/useOfflineAction.ts para onde entra
 * em jogo (só nos 4 pontos de mutação de técnico da Fase 1).
 */

import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection, type RxJsonSchema, type RxConflictHandler } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'

export type LocalTask = {
  id: string
  companyId: string
  title: string
  description: string | null
  assetId: string | null
  tag: string | null
  area: string | null
  status: string
  criticidade: string
  tipo: string
  dueDate: string | null
  plannedStartDate: string | null
  startedAt: string | null
  completedAt: string | null
  observacoes: string | null
  assignedTo: string | null
  assignedToIds: string[]
  requiredFRs: string[]
  requiredITs: string[]
  completedFRs: Record<string, any> | null
  acknowledgedITs: string[]
  safetyRules: string[]
  updatedAt: string
  createdAt: string
  // Preenchido localmente quando uma escrita offline fica pendente/recusada — nunca vem
  // do servidor. Ver useOfflineAction.
  _localSyncState?: 'pending' | 'rejected' | null
  _localSyncReason?: string | null
  // Diz à rota de sincronização (push) que operação de gestor de OT aplicar — sem isto
  // o servidor teria de "adivinhar" o que mudou a partir do documento completo.
  // Limpo (null) depois de sincronizado com sucesso.
  _pendingOp?: { type: 'status' | 'frsIts' | 'execDetails'; payload: any } | null
}

export type LocalIntervention = {
  id: string
  companyId: string
  taskId: string
  technicianId: string | null
  startedAt: string | null
  endedAt: string | null
  observations: string | null
  checklist: { label: string; done: boolean }[]
  photoUrls: string[] | null
  updatedAt: string
  createdAt: string
  _localSyncState?: 'pending' | 'rejected' | null
  _localSyncReason?: string | null
}

export type LocalAssetRef = {
  id: string
  companyId: string
  name: string
  tag: string | null
  area: string | null
}

export type LocalSafetyRule = {
  id: string
  companyId: string
  title: string
  category: string | null
}

const taskSchema: RxJsonSchema<LocalTask> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 200 },
    companyId: { type: 'string' },
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    assetId: { type: ['string', 'null'] },
    tag: { type: ['string', 'null'] },
    area: { type: ['string', 'null'] },
    status: { type: 'string' },
    criticidade: { type: 'string' },
    tipo: { type: 'string' },
    dueDate: { type: ['string', 'null'] },
    plannedStartDate: { type: ['string', 'null'] },
    startedAt: { type: ['string', 'null'] },
    completedAt: { type: ['string', 'null'] },
    observacoes: { type: ['string', 'null'] },
    assignedTo: { type: ['string', 'null'] },
    assignedToIds: { type: 'array', items: { type: 'string' } },
    requiredFRs: { type: 'array', items: { type: 'string' } },
    requiredITs: { type: 'array', items: { type: 'string' } },
    completedFRs: { type: ['object', 'null'] },
    acknowledgedITs: { type: 'array', items: { type: 'string' } },
    safetyRules: { type: 'array', items: { type: 'string' } },
    updatedAt: { type: 'string' },
    createdAt: { type: 'string' },
    _localSyncState: { type: ['string', 'null'] },
    _localSyncReason: { type: ['string', 'null'] },
    _pendingOp: { type: ['object', 'null'] },
  },
  required: ['id', 'companyId', 'title', 'status', 'updatedAt', 'createdAt'],
  indexes: ['companyId', 'status'],
} as any

const interventionSchema: RxJsonSchema<LocalIntervention> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 200 },
    companyId: { type: 'string' },
    taskId: { type: 'string', maxLength: 200 },
    technicianId: { type: ['string', 'null'] },
    startedAt: { type: ['string', 'null'] },
    endedAt: { type: ['string', 'null'] },
    observations: { type: ['string', 'null'] },
    checklist: { type: 'array', items: { type: 'object' } },
    photoUrls: { type: ['array', 'null'], items: { type: 'string' } },
    updatedAt: { type: 'string' },
    createdAt: { type: 'string' },
    _localSyncState: { type: ['string', 'null'] },
    _localSyncReason: { type: ['string', 'null'] },
  },
  required: ['id', 'companyId', 'taskId', 'updatedAt', 'createdAt'],
  indexes: ['companyId', 'taskId'],
} as any

const assetRefSchema: RxJsonSchema<LocalAssetRef> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 200 },
    companyId: { type: 'string' },
    name: { type: 'string' },
    tag: { type: ['string', 'null'] },
    area: { type: ['string', 'null'] },
  },
  required: ['id', 'companyId', 'name'],
  indexes: ['companyId'],
} as any

const safetyRuleSchema: RxJsonSchema<LocalSafetyRule> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 200 },
    companyId: { type: 'string' },
    title: { type: 'string' },
    category: { type: ['string', 'null'] },
  },
  required: ['id', 'companyId', 'title'],
  indexes: ['companyId'],
} as any

/**
 * Política de conflito aprovada: uma alteração de técnico feita offline NUNCA sobrepõe
 * silenciosamente uma alteração feita entretanto no servidor (ex.: gestor reatribuiu ou
 * cancelou a OT) — é recusada e fica visível na UI (_localSyncState: 'rejected'), nunca
 * apenas descartada. `assumedMasterState` é o estado da OT que o técnico tinha quando fez
 * a alteração local; se já não bate certo com `realMasterState` (o estado atual real),
 * houve uma alteração concorrente e a versão local é recusada.
 */
const taskConflictHandler: RxConflictHandler<LocalTask> = {
  isEqual: (a, b) => a.updatedAt === b.updatedAt,
  resolve: async (i) => {
    const noConflict = !i.assumedMasterState || i.assumedMasterState.updatedAt === i.realMasterState.updatedAt
    if (noConflict) {
      return { ...i.newDocumentState, _localSyncState: null, _localSyncReason: null }
    }
    return {
      ...i.realMasterState,
      _localSyncState: 'rejected',
      _localSyncReason: 'Esta OT foi alterada entretanto (por outra pessoa ou noutro dispositivo) — a tua alteração offline não foi aplicada. Revê os dados atuais e repete se ainda for necessário.',
    }
  },
}

const interventionConflictHandler: RxConflictHandler<LocalIntervention> = {
  isEqual: (a, b) => a.updatedAt === b.updatedAt,
  resolve: async (i) => {
    const noConflict = !i.assumedMasterState || i.assumedMasterState.updatedAt === i.realMasterState.updatedAt
    if (noConflict) return { ...i.newDocumentState, _localSyncState: null, _localSyncReason: null }
    return {
      ...i.realMasterState,
      _localSyncState: 'rejected',
      _localSyncReason: 'Esta intervenção não foi aceite pelo servidor (ex.: limite de intervenções do plano atingido, ou a OT já não existe). Revê antes de tentar de novo.',
    }
  },
}

export type TechnicianCollections = {
  tasks: RxCollection<LocalTask>
  interventions: RxCollection<LocalIntervention>
  assetRefs: RxCollection<LocalAssetRef>
  safetyRules: RxCollection<LocalSafetyRule>
}

let dbPromise: Promise<RxDatabase<TechnicianCollections>> | null = null

/**
 * Base de dados única por separador. Em dev (NODE_ENV !== 'production') ativa o
 * dev-mode do RxDB (mensagens de erro completas) — só é carregado condicionalmente
 * para não pesar o bundle de produção.
 */
export async function getTechnicianDB(): Promise<RxDatabase<TechnicianCollections>> {
  if (typeof window === 'undefined') {
    throw new Error('A base de dados offline do técnico só existe no browser.')
  }
  if (dbPromise) return dbPromise

  dbPromise = (async () => {
    if (process.env.NODE_ENV !== 'production') {
      const { RxDBDevModePlugin } = await import('rxdb/plugins/dev-mode')
      addRxPlugin(RxDBDevModePlugin)
    }

    const db = await createRxDatabase<TechnicianCollections>({
      name: 'rgmaintenance_technician',
      storage: getRxStorageDexie(),
      multiInstance: true,
      eventReduce: true,
      ignoreDuplicate: true,
    })

    await db.addCollections({
      tasks: { schema: taskSchema, conflictHandler: taskConflictHandler },
      interventions: { schema: interventionSchema, conflictHandler: interventionConflictHandler },
      assetRefs: { schema: assetRefSchema },
      safetyRules: { schema: safetyRuleSchema },
    })

    return db
  })()

  return dbPromise
}
