import type { PlanName } from '@/types/models'

export type FeatureKey = 'assets' | 'history' | 'users' | 'reports' | 'maintenance-plan' | 'calendar' | 'stocks' | 'finance' | 'aiConsultant' | 'reliability' | 'compliance' | 'projects' | 'warehouses' | 'safetyRules' | 'messages' | 'documents' | 'predictive'

export interface PlanLimits {
  maxUsers: number
  interventionsPerMonth: number
  // Config guardada para uso futuro — ainda NÃO é aplicada em lado nenhum
  // (a página de Relatórios é um dashboard de visualização/exportação, não
  // um fluxo de "criar N relatórios"; falta definir o que conta como "1").
  reportsPerMonth: number
  maxAssets: number
  maxStockItems: number
  maxWarehouses: number
  maxSafetyRules: number
  messagesPerMonth: number
  maxMaintenancePlans: number
  maxOpenProjects: number
  maxFRs: number
  maxITs: number
  // Base de Conhecimento (Gestão Documental, type 'MANUAL') — manuais/normas/PDFs
  // enviados pela empresa. Mesmo gate que FR/IT (feature 'documents').
  maxManuals: number
}

const GATES: Record<PlanName, Record<FeatureKey, boolean>> = {
  // 'free' passou a ser o Módulo Base, pago (deixou de ser grátis) — a chave interna
  // mantém-se 'free' para não obrigar a migrar o campo `plan` já gravado em todas as
  // empresas existentes; só o que o utilizador vê (label, preço) mudou (ver PLAN_LABELS).
  free:       { assets: true,  history: true,  users: true,  reports: false, 'maintenance-plan': false, calendar: false, stocks: false, finance: false, aiConsultant: false, reliability: false, compliance: false, projects: false, warehouses: false, safetyRules: false, messages: false, documents: false, predictive: false },
  starter:    { assets: true,  history: true,  users: true,  reports: true,  'maintenance-plan': false, calendar: true,  stocks: true,  finance: false, aiConsultant: false, reliability: false, compliance: false, projects: false, warehouses: true,  safetyRules: true,  messages: true,  documents: false, predictive: false },
  pro:        { assets: true,  history: true,  users: true,  reports: true,  'maintenance-plan': true,  calendar: true,  stocks: true,  finance: false, aiConsultant: false, reliability: true,  compliance: false, projects: true,  warehouses: true,  safetyRules: true,  messages: true,  documents: true,  predictive: false },
  business:   { assets: true,  history: true,  users: true,  reports: true,  'maintenance-plan': true,  calendar: true,  stocks: true,  finance: true,  aiConsultant: true,  reliability: true,  compliance: false, projects: true,  warehouses: true,  safetyRules: true,  messages: true,  documents: true,  predictive: true  },
  enterprise: { assets: true,  history: true,  users: true,  reports: true,  'maintenance-plan': true,  calendar: true,  stocks: true,  finance: true,  aiConsultant: true,  reliability: true,  compliance: true,  projects: true,  warehouses: true,  safetyRules: true,  messages: true,  documents: true,  predictive: true  },
}

export const LIMITS: Record<PlanName, PlanLimits> = {
  free:       { maxUsers: 2,    interventionsPerMonth: 20,   reportsPerMonth: 1,   maxAssets: 5,    maxStockItems: 0,   maxWarehouses: 0, maxSafetyRules: 0,  messagesPerMonth: 0,   maxMaintenancePlans: 0,  maxOpenProjects: 0, maxFRs: 0,  maxITs: 0,  maxManuals: 0  },
  starter:    { maxUsers: 5,    interventionsPerMonth: 100,  reportsPerMonth: 10,  maxAssets: 25,   maxStockItems: 50,  maxWarehouses: 3, maxSafetyRules: 10, messagesPerMonth: 100, maxMaintenancePlans: 25, maxOpenProjects: 0, maxFRs: 0,  maxITs: 0,  maxManuals: 0  },
  pro:        { maxUsers: 15,   interventionsPerMonth: 500,  reportsPerMonth: 100, maxAssets: 100,  maxStockItems: 100, maxWarehouses: 5, maxSafetyRules: 20, messagesPerMonth: 500, maxMaintenancePlans: 50, maxOpenProjects: 5, maxFRs: 20, maxITs: 20, maxManuals: 20 },
  business:   { maxUsers: 9999, interventionsPerMonth: 9999, reportsPerMonth: 9999, maxAssets: 9999, maxStockItems: 9999, maxWarehouses: 9999, maxSafetyRules: 9999, messagesPerMonth: 9999, maxMaintenancePlans: 9999, maxOpenProjects: 9999, maxFRs: 9999, maxITs: 9999, maxManuals: 9999 },
  enterprise: { maxUsers: 9999, interventionsPerMonth: 9999, reportsPerMonth: 9999, maxAssets: 9999, maxStockItems: 9999, maxWarehouses: 9999, maxSafetyRules: 9999, messagesPerMonth: 9999, maxMaintenancePlans: 9999, maxOpenProjects: 9999, maxFRs: 9999, maxITs: 9999, maxManuals: 9999 },
}

export const TEASER_LIMITS: Record<FeatureKey, number> = {
  assets: 9999,
  history: 0,
  users: 2,
  reports: 0,
  'maintenance-plan': 1,
  calendar: 0,
  stocks: 9999,
  finance: 0,
  aiConsultant: 0,
  reliability: 0,
  compliance: 0,
  projects: 9999,
  warehouses: 0,
  safetyRules: 0,
  messages: 0,
  documents: 0,
  predictive: 0,
}

export const PLAN_LABELS: Record<PlanName, string> = {
  free:       'Base',
  starter:    'Starter',
  pro:        'Pro',
  business:   'Business',
  enterprise: 'Enterprise',
}

const PLAN_ORDER: PlanName[] = ['free', 'starter', 'pro', 'business', 'enterprise']

export function planHas(plan: PlanName, feature: FeatureKey): boolean {
  return GATES[plan]?.[feature] ?? false
}

export function minPlanFor(feature: FeatureKey): PlanName {
  return PLAN_ORDER.find((p) => GATES[p][feature]) ?? 'pro'
}

export const PLAN_UPGRADE_HINT: Record<PlanName, string> = {
  free:       'Disponível no plano Starter',
  starter:    'Disponível no plano Pro',
  pro:        'Disponível no plano Business',
  business:   'Business',
  enterprise: 'Enterprise',
}
