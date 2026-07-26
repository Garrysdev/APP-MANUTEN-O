// Modelos de dados RG Maintenance (Firestore).
// Cada documento de coleção de negócio guarda `companyId` para multi-tenancy.

export type UserRole = 'manager' | 'technician'
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'
export type StockMovementType = 'in' | 'out'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskCriticidade = 'vermelho' | 'amarelo' | 'verde'
export type TipoTarefa =
  | 'preventiva'
  | 'curativa'
  | 'plano'
  | 'inspecao'
  | 'lubrificacao'
  | 'calibracao'
  | 'outro'
export type PlanName = 'free' | 'starter' | 'pro' | 'business' | 'enterprise'
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'

/** Periodicidades do Plano de Manutenção (PLMAN01), normalizadas do Excel. */
export type Periodicidade =
  | 'semanal'
  | 'mensal'
  | 'trimestral'
  | 'bianual' // 2×/ano (semestral)
  | 'anual'
  | 'bienal' // de 2 em 2 anos
  | 'trianual' // de 3 em 3 anos
  | 'horas' // por horas de funcionamento / condição
  | 'pontual' // ficha de registo / plano avulso

/** Tipos de técnico / especialidades padrão. */
export const DEFAULT_TECHNICIAN_TYPES = [
  'Mecânico',
  'Eletricista',
  'HVAC / Climatização',
  'Automação & Eletrónica',
  'Serralharia / Tubagem',
  'Multidisciplinar',
]

/** Quem executa a tarefa de plano: interno (RG) ou prestador externo (sufixo -STP). */
export type Executor = 'interno' | 'externo'

export interface Company {
  id: string
  name: string
  slug: string
  plan: PlanName
  maxTechnicians: number
  logoUrl?: string | null
  activeModules?: string[]
  aiCredits?: number
  technicianTypes?: string[]
  createdAt: string // ISO
}

export interface User {
  id: string // = uid do Firebase Auth
  companyId: string
  email: string
  name: string
  abbreviation?: string | null // Abreviatura / Código de 3 dígitos (ex: LM, RG, MS, CB)
  role: UserRole
  avatarUrl?: string | null
  specialty?: string | null // Especialidade / Tipo de técnico
  active: boolean
  createdAt: string
  hourlyRate?: number // Custo hora do técnico
  language?: 'pt' | 'en' | 'es' | 'fr'
  pushSubscription?: any // Token do Web Push
}

/** Perfil enriquecido usado na UI (user + empresa resolvida). */
export interface UserProfile extends User {
  company?: Pick<Company, 'id' | 'name' | 'plan' | 'activeModules' | 'aiCredits'> | null
}

/** Categoria de criticidade do cadastro (A/B/C) usada no plano de manutenção. */
export type CriticidadeABC = 'A' | 'B' | 'C'

export interface Asset {
  id: string
  companyId: string
  name: string // = DESIGNAÇÃO do cadastro
  location?: string | null
  type?: string | null
  serialNumber?: string | null
  tags?: string[] | null
  photoUrl?: string | null
  notes?: string | null // = OBSERVAÇÕES do cadastro
  active: boolean
  createdAt: string
  // ── Campos do cadastro de manutenção (CADASTRO_UR) ──
  area?: string | null // ex.: "80", "130INK"
  tag?: string | null // TAG canónica, ex.: "80 F1 B1"
  system?: string | null // SISTEMA, ex.: "AGUAS", "PT"
  manufacturer?: string | null // FORNECEDOR / FABRICANTE
  characteristics?: string | null // CARACTERISTICAS
  criticidadeABC?: CriticidadeABC | null // categoria A/B/C
}

export interface Task {
  id: string
  companyId: string
  title: string
  description?: string | null
  assetId?: string | null
  assignedTo?: string | null
  criticidade: TaskCriticidade
  tipo: TipoTarefa
  status: TaskStatus
  dueDate?: string | null // ISO date
  safetyRules?: string[] | null
  materialsRequired?: string[] | null
  maintenancePlanId?: string | null
  totalCost?: number | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ChecklistItem {
  label: string
  done: boolean
}

export interface Intervention {
  id: string
  companyId: string
  taskId: string
  technicianId: string
  startedAt?: string | null
  endedAt?: string | null
  observations?: string | null
  checklist: ChecklistItem[]
  photoUrls?: string[] | null
  createdAt: string
}

export interface Material {
  id: string
  companyId: string
  interventionId: string
  name: string
  reference?: string | null
  quantity: number
  unit?: string | null
  unitCost?: number | null
  createdAt: string
}

export interface MaintenancePlan {
  id: string
  companyId: string
  title: string
  description?: string | null
  assetId?: string | null
  assignedTo?: string | null
  criticidade: TaskCriticidade
  tipo: TipoTarefa
  recurrence: RecurrenceType
  recurrenceValue: number
  safetyRules?: string[] | null
  active: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  lastGeneratedAt?: string | null
  // ── Campos do Plano de Manutenção (PLMAN01) ──
  periodicidade?: Periodicidade | null // periodicidade normalizada
  periodicidadeLabel?: string | null // rótulo original do Excel, ex.: "BIANUAL-STP"
  executor?: Executor | null // interno / externo (-STP)
  legal?: boolean | null // inspeção obrigatória/regulamentar (-legal)
  months?: string | null // MÊS, ex.: "JAN, ABR, JUL, OUT"
  tag?: string | null // TAG do equipamento (liga ao Asset)
  area?: string | null
  system?: string | null
}

export interface StockItem {
  id: string
  companyId: string
  name: string
  reference?: string | null
  category?: string | null
  quantity: number
  unit?: string | null
  unitCost?: number | null
  minQuantity?: number | null
  location?: string | null
  createdAt: string
  updatedAt: string
}

export interface StockMovement {
  id: string
  companyId: string
  stockItemId: string
  quantity: number
  type: StockMovementType
  cost?: number | null
  description?: string | null
  createdAt: string
  createdBy: string
}

export interface Invite {
  id: string
  companyId: string
  role: UserRole
  token: string
  used: boolean
  email?: string | null
  expiresAt?: string | null
  createdAt: string
}

// Rótulos PT para apresentação
export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em curso',
  done: 'Concluída',
  cancelled: 'Cancelada',
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

export const CRITICIDADE_LABELS: Record<TaskCriticidade, string> = {
  vermelho: 'Crítica',
  amarelo: 'Média',
  verde: 'Baixa',
}

export const TIPO_LABELS: Record<TipoTarefa, string> = {
  preventiva: 'Manutenção Preventiva',
  curativa: 'Manutenção Curativa',
  plano: 'Plano de Manutenção',
  inspecao: 'Inspeção',
  lubrificacao: 'Lubrificação',
  calibracao: 'Calibração',
  outro: 'Outro',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  manager: 'Gestor',
  technician: 'Técnico',
}

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  annual: 'Anual',
}

export const PERIODICIDADE_LABELS: Record<Periodicidade, string> = {
  semanal: 'Semanal',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  bianual: 'Bianual (2×/ano)',
  anual: 'Anual',
  bienal: 'Bienal (2/2 anos)',
  trianual: 'Trianual (3/3 anos)',
  horas: 'Por horas de funcionamento',
  pontual: 'Pontual / Ficha de registo',
}

export const EXECUTOR_LABELS: Record<Executor, string> = {
  interno: 'Interno (RG)',
  externo: 'Externo (prestador)',
}

/**
 * Converte uma periodicidade do plano para o motor de recorrência (recurrence + valor).
 * Ex.: bianual → { recurrence: 'monthly', recurrenceValue: 6 } (a cada 6 meses).
 */
export function periodicidadeToRecurrence(
  p: Periodicidade
): { recurrence: RecurrenceType; recurrenceValue: number } {
  switch (p) {
    case 'semanal': return { recurrence: 'weekly', recurrenceValue: 1 }
    case 'mensal': return { recurrence: 'monthly', recurrenceValue: 1 }
    case 'trimestral': return { recurrence: 'quarterly', recurrenceValue: 1 }
    case 'bianual': return { recurrence: 'monthly', recurrenceValue: 6 }
    case 'anual': return { recurrence: 'annual', recurrenceValue: 1 }
    case 'bienal': return { recurrence: 'annual', recurrenceValue: 2 }
    case 'trianual': return { recurrence: 'annual', recurrenceValue: 3 }
    case 'horas': return { recurrence: 'monthly', recurrenceValue: 1 }
    case 'pontual': return { recurrence: 'annual', recurrenceValue: 1 }
  }
}
