import type { PlanName } from '@/types/models'

export type FeatureKey = 'assets' | 'history' | 'users' | 'reports' | 'maintenance-plan' | 'calendar' | 'stocks' | 'finance' | 'aiConsultant' | 'reliability' | 'compliance' | 'projects'

export interface PlanLimits {
  maxUsers: number
  interventionsPerMonth: number
  reportsPerMonth: number
}

const GATES: Record<PlanName, Record<FeatureKey, boolean>> = {
  free:       { assets: true,  history: false, users: false, reports: false, 'maintenance-plan': false, calendar: false, stocks: true,  finance: false, aiConsultant: false, reliability: false, compliance: false, projects: false },
  starter:    { assets: true,  history: false, users: false, reports: true,  'maintenance-plan': false, calendar: true,  stocks: true,  finance: false, aiConsultant: false, reliability: false, compliance: false, projects: true  },
  pro:        { assets: true,  history: true,  users: true,  reports: true,  'maintenance-plan': true,  calendar: true,  stocks: true,  finance: false, aiConsultant: false, reliability: true,  compliance: false, projects: true  },
  business:   { assets: true,  history: true,  users: true,  reports: true,  'maintenance-plan': true,  calendar: true,  stocks: true,  finance: true,  aiConsultant: true,  reliability: true,  compliance: false, projects: true  },
  enterprise: { assets: true,  history: true,  users: true,  reports: true,  'maintenance-plan': true,  calendar: true,  stocks: true,  finance: true,  aiConsultant: true,  reliability: true,  compliance: true,  projects: true  },
}

export const LIMITS: Record<PlanName, PlanLimits> = {
  free:       { maxUsers: 2,    interventionsPerMonth: 20,   reportsPerMonth: 1  },
  starter:    { maxUsers: 5,    interventionsPerMonth: 100,  reportsPerMonth: 10 },
  pro:        { maxUsers: 15,   interventionsPerMonth: 500,  reportsPerMonth: 99 },
  business:   { maxUsers: 9999, interventionsPerMonth: 9999, reportsPerMonth: 99 },
  enterprise: { maxUsers: 9999, interventionsPerMonth: 9999, reportsPerMonth: 99 },
}

export const TEASER_LIMITS: Record<FeatureKey, number> = {
  assets: 3,
  history: 0,
  users: 2,
  reports: 0,
  'maintenance-plan': 1,
  calendar: 0,
  stocks: 1,
  finance: 0,
  aiConsultant: 0,
  reliability: 0,
  compliance: 0,
  projects: 2,
}

export const PLAN_LABELS: Record<PlanName, string> = {
  free:       'Free',
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
