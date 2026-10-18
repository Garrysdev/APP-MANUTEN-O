// Helpers de sessão no servidor. Lê o cookie de sessão Firebase, verifica-o com o
// Admin SDK e devolve o perfil do utilizador (com a empresa) a partir do Firestore.
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { unstable_cache } from 'next/cache'
import type { DocumentSnapshot } from 'firebase-admin/firestore'
import { adminAuth, adminDb, firestoreWithTimeout, isQuotaExhausted } from './admin'
import type { UserProfile, UserRole } from '@/types/models'

export const SESSION_COOKIE = '__session'
export const DEMO_COMPANY_ID = 'rjHNaSUbLm4qTMyKP0oX'

/** Verifica o cookie de sessão e devolve o uid + claims, ou null se inválido/ausente. */
export async function getSessionUser() {
  const store = await cookies()
  const cookie = store.get(SESSION_COOKIE)?.value
  if (!cookie) return null
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true)
    return decoded
  } catch {
    return null
  }
}

type ProfileDocs = {
  userId: string
  userData: Record<string, any>
  company: Record<string, any> | null
}

// Documentos do perfil (users + companies) em cache por utilizador. Sem isto, cada
// pedido — cada navegação, cada Server Action e cada poll do sino — custava 2 leituras.
// Invalidada pelas etiquetas 'users' (qualquer escrita em utilizadores, incluindo
// desativar uma conta) e 'companies' (plano, nome/logótipo, créditos IA).
// Erros são lançados (não devolvidos) para nunca ficar uma falha guardada em cache;
// um utilizador sem documento devolve null (perfil de reserva, como antes).
function loadProfileDocs(uid: string, email: string): Promise<ProfileDocs | null> {
  return unstable_cache(
    async (uid: string, email: string): Promise<ProfileDocs | null> => {
      const db = adminDb()
      let userSnap: DocumentSnapshot = await db.collection('users').doc(uid).get()
      // Se o documento por uid não existir no Firestore, procurar por email
      if (!userSnap.exists && email) {
        const emailSnap = await db.collection('users').where('email', '==', email).limit(1).get()
        if (!emailSnap.empty) userSnap = emailSnap.docs[0]
      }
      if (!userSnap.exists) return null

      const userData = userSnap.data() || {}
      const companyId = userData.companyId || DEMO_COMPANY_ID
      const companySnap = await db.collection('companies').doc(companyId).get()
      return {
        userId: userSnap.id,
        userData,
        company: companySnap.exists ? (companySnap.data() || {}) : null,
      }
    },
    ['profile-docs'],
    { revalidate: 300, tags: ['users', 'companies'] }
  )(uid, email)
}

// Último perfil lido com sucesso, por uid, nesta instância do servidor. Numa falha
// temporária do Firestore (quota, timeout) serve-se este antes do perfil de reserva.
const lastGoodProfile = new Map<string, UserProfile>()

/** Devolve o perfil completo (user + company) do utilizador autenticado, ou null. */
export const getCurrentProfile = cache(async function (): Promise<UserProfile | null> {
  const session = await getSessionUser().catch(() => null)
  if (!session) return null

  const userEmail = (session.email || '').toLowerCase().trim()
  // Por uid, ou por email só se verificado: um gestor pode mudar o email de uma conta
  // (updateUserByManagerAction) e, por email sozinho, ganhava o acesso de administrador
  // e o perfil de reserva da Empresa UR.
  const isRGAdmin =
    session.uid === 'nLqzaMwMu1OR4CKZzatjTlNBWt82' ||
    (session.email_verified === true && (userEmail === 'garrido.rui@gmail.com' || userEmail === 'admin@rgmaintenance.com'))

  const KNOWN_USERS = [
    { id: 'mWSsTRtgq5QcOHusTdVYgDVrwHt2', email: 'tecnico@teste.rg', name: 'RuiG', abbreviation: 'RU', role: 'technician' },
    { id: 'MEGjjvqtGqv3Oosxvlrx', email: 'lm@rgmaintenance.pt', name: 'Leandro Maia', abbreviation: 'LM', role: 'technician' },
    { id: 'nAcCSm4E3tNnPLr72UPl', email: 'ms@rgmaintenance.pt', name: 'Marco Silva', abbreviation: 'MS', role: 'technician' },
    { id: 'zmDAeoGTzIWPavraKu0f', email: 'cb@rgmaintenance.pt', name: 'Carlos Branco', abbreviation: 'CB', role: 'technician' },
    { id: 'nLqzaMwMu1OR4CKZzatjTlNBWt82', email: 'garrido.rui@gmail.com', name: 'Rui Garrido', abbreviation: 'RG', role: 'manager' },
  ]
  // Por uid, ou por email só se verificado (o email pode ser alterado — ver isRGAdmin).
  const matchedKnown = KNOWN_USERS.find(
    (k) => k.id === session.uid || (session.email_verified === true && userEmail && k.email.toLowerCase() === userEmail)
  )

  const buildFallbackProfile = (): UserProfile => ({
    id: matchedKnown?.id || session.uid,
    email: userEmail || matchedKnown?.email || '',
    name: matchedKnown?.name || session.name || (isRGAdmin ? 'Rui Garrido' : 'Utilizador'),
    abbreviation: matchedKnown?.abbreviation || (isRGAdmin ? 'RG' : null),
    role: (isRGAdmin ? 'manager' : (matchedKnown?.role || 'technician')) as UserRole,
    companyId: DEMO_COMPANY_ID,
    active: true,
    createdAt: new Date().toISOString(),
    company: {
      id: DEMO_COMPANY_ID,
      name: 'Empresa UR',
      plan: 'enterprise',
      activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history', 'messages'],
      aiCredits: 100,
      logoUrl: null,
    },
  })

  // O perfil de reserva é o da Empresa UR, por isso só serve às contas conhecidas da UR.
  // Antes era dado a QUALQUER utilizador autenticado sempre que o Firestore falhava —
  // um cliente de outra empresa entrava na UR com plano Enterprise (fuga cross-tenant).
  // Os restantes recebem o último perfil bom em memória ou null (volta ao login).
  const isURAccount = isRGAdmin || !!matchedKnown
  const fallbackOrNull = (): UserProfile | null => {
    const last = lastGoodProfile.get(session.uid)
    if (last) return last
    if (isURAccount) return buildFallbackProfile()
    console.warn('[getCurrentProfile] Firestore indisponível e sem perfil em memória para', session.uid)
    return null
  }

  if (isQuotaExhausted()) {
    return fallbackOrNull()
  }

  try {
    let docs = await firestoreWithTimeout(() => loadProfileDocs(session.uid, userEmail), null, 2000)
    // Sem perfil de reserva para estas contas: dar mais tempo antes de as mandar ao login.
    if (!docs && !isURAccount && !lastGoodProfile.has(session.uid) && !isQuotaExhausted()) {
      docs = await firestoreWithTimeout(() => loadProfileDocs(session.uid, userEmail), null, 3000)
    }
    if (!docs) {
      return fallbackOrNull()
    }
    const docData = docs.userData

    const rawRole = (docData.role as string)?.toLowerCase()?.trim()
    const userRole = isRGAdmin
      ? 'manager'
      : ((rawRole === 'technician' || rawRole === 'tecnico' || rawRole === 'técnico' || rawRole === 'tech') ? 'technician' : (rawRole || 'manager'))

    const companyId = docData.companyId || DEMO_COMPANY_ID

    const user = {
      id: docs.userId,
      ...docData, 
      name: docData.name || matchedKnown?.name || session.name || 'Utilizador',
      abbreviation: docData.abbreviation || matchedKnown?.abbreviation || (isRGAdmin ? 'RG' : null),
      role: userRole,
      companyId
    } as UserProfile

    if (user.active === false) {
      lastGoodProfile.delete(session.uid)
      return null
    }

    if (docs.company) {
      const c = docs.company
      user.company = {
        id: companyId,
        name: c.name || 'Empresa UR',
        plan: (isRGAdmin || companyId === DEMO_COMPANY_ID) ? 'enterprise' : (c.plan || 'starter'),
        activeModules: c.activeModules || ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history', 'messages'],
        aiCredits: c.aiCredits || 100,
        logoUrl: c.logoUrl || null,
      }
    } else {
      user.company = {
        id: companyId,
        name: isRGAdmin ? 'Empresa UR' : 'Minha Empresa',
        plan: (isRGAdmin || companyId === DEMO_COMPANY_ID) ? 'enterprise' : 'starter',
        activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history', 'messages'],
        aiCredits: 100,
        logoUrl: null,
      }
    }

    lastGoodProfile.set(session.uid, user)
    return user
  } catch (err: any) {
    console.error('[getCurrentProfile Error]:', err)
    return fallbackOrNull()
  }
})
