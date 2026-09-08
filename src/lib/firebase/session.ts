// Helpers de sessão no servidor. Lê o cookie de sessão Firebase, verifica-o com o
// Admin SDK e devolve o perfil do utilizador (com a empresa) a partir do Firestore.
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from './admin'
import type { UserProfile } from '@/types/models'

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

/** Devolve o perfil completo (user + company) do utilizador autenticado, ou null. */
export const getCurrentProfile = cache(async function (): Promise<UserProfile | null> {
  const session = await getSessionUser().catch(() => null)
  if (!session) return null

  const userEmail = (session.email || '').toLowerCase().trim()
  const isRGAdmin = userEmail === 'garrido.rui@gmail.com' || userEmail === 'admin@rgmaintenance.com'

  try {
    const db = adminDb()
    let userSnap = await db.collection('users').doc(session.uid).get()
    
    // Se o documento por session.uid não existir no Firestore, procurar por email
    if (!userSnap.exists && userEmail) {
      const emailSnap = await db.collection('users').where('email', '==', userEmail).limit(1).get().catch(() => null)
      if (emailSnap && !emailSnap.empty) {
        userSnap = emailSnap.docs[0]
      }
    }

    const docData = (userSnap && userSnap.exists) ? (userSnap.data() || {}) : {}
    const KNOWN_USERS = [
      { id: 'mWSsTRtgq5QcOHusTdVYgDVrwHt2', email: 'tecnico@teste.rg', name: 'RG - RuiG', abbreviation: 'RG', role: 'technician' },
      { id: 'MEGjjvqtGqv3Oosxvlrx', email: 'lm@rgmaintenance.pt', name: 'Leandro Maia', abbreviation: 'LM', role: 'technician' },
      { id: 'nAcCSm4E3tNnPLr72UPl', email: 'ms@rgmaintenance.pt', name: 'Marco Silva', abbreviation: 'MS', role: 'technician' },
      { id: 'zmDAeoGTzIWPavraKu0f', email: 'cb@rgmaintenance.pt', name: 'Carlos Branco', abbreviation: 'CB', role: 'technician' },
      { id: 'CUodZKziOwo128GLK66i', email: 'garrido.rui@gmail.com', name: 'Rui Garrido (RG)', abbreviation: 'RG', role: 'manager' },
      { id: 'nLqzaMwMu1OR4CKZzatjTlNBWt82', email: 'demo@rgmaintenance.pt', name: 'Admin', abbreviation: 'ADM', role: 'manager' },
    ]
    const matchedKnown = KNOWN_USERS.find((k) => k.id === session.uid || (userEmail && k.email.toLowerCase() === userEmail))

    if (!userSnap || !userSnap.exists) {
      const targetCompanyId = (session as any).companyId || DEMO_COMPANY_ID
      const fallbackRole = isRGAdmin ? 'manager' : (matchedKnown?.role || 'technician')
      return {
        id: matchedKnown?.id || session.uid,
        email: userEmail || matchedKnown?.email || '',
        name: matchedKnown?.name || session.name || (isRGAdmin ? 'Rui Garrido' : 'Utilizador'),
        abbreviation: matchedKnown?.abbreviation || (isRGAdmin ? 'RG' : null),
        role: fallbackRole,
        companyId: targetCompanyId,
        company: {
          id: targetCompanyId,
          name: 'Empresa UR',
          plan: 'enterprise',
          activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history', 'messages'],
          aiCredits: 100,
        },
      } as UserProfile
    }

    const rawRole = (docData.role as string)?.toLowerCase()?.trim()
    const userRole = isRGAdmin
      ? 'manager'
      : ((rawRole === 'technician' || rawRole === 'tecnico' || rawRole === 'técnico' || rawRole === 'tech') ? 'technician' : (rawRole || 'manager'))

    const companyId = docData.companyId || DEMO_COMPANY_ID

    const user = { 
      id: userSnap.id, 
      ...docData, 
      name: docData.name || matchedKnown?.name || session.name || 'Utilizador',
      abbreviation: docData.abbreviation || matchedKnown?.abbreviation || (isRGAdmin ? 'RG' : null),
      role: userRole,
      companyId
    } as UserProfile

    if (user.active === false) return null

    const companySnap = await db.collection('companies').doc(companyId).get().catch(() => null)
    if (companySnap?.exists) {
      const c = companySnap.data()!
      user.company = { 
        id: companySnap.id, 
        name: c.name || 'Empresa UR', 
        plan: (isRGAdmin || companyId === DEMO_COMPANY_ID) ? 'enterprise' : (c.plan || 'starter'), 
        activeModules: c.activeModules || ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history', 'messages'],
        aiCredits: c.aiCredits || 100 
      }
    } else {
      user.company = {
        id: companyId,
        name: isRGAdmin ? 'Empresa UR' : 'Minha Empresa',
        plan: (isRGAdmin || companyId === DEMO_COMPANY_ID) ? 'enterprise' : 'starter',
        activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history', 'messages'],
        aiCredits: 100
      }
    }

    return user
  } catch (err: any) {
    console.error('[getCurrentProfile Error]:', err)
    const KNOWN_USERS = [
      { id: 'mWSsTRtgq5QcOHusTdVYgDVrwHt2', email: 'tecnico@teste.rg', name: 'RG - RuiG', abbreviation: 'RG', role: 'technician' },
      { id: 'MEGjjvqtGqv3Oosxvlrx', email: 'lm@rgmaintenance.pt', name: 'Leandro Maia', abbreviation: 'LM', role: 'technician' },
      { id: 'nAcCSm4E3tNnPLr72UPl', email: 'ms@rgmaintenance.pt', name: 'Marco Silva', abbreviation: 'MS', role: 'technician' },
      { id: 'zmDAeoGTzIWPavraKu0f', email: 'cb@rgmaintenance.pt', name: 'Carlos Branco', abbreviation: 'CB', role: 'technician' },
      { id: 'CUodZKziOwo128GLK66i', email: 'garrido.rui@gmail.com', name: 'Rui Garrido (RG)', abbreviation: 'RG', role: 'manager' },
      { id: 'nLqzaMwMu1OR4CKZzatjTlNBWt82', email: 'demo@rgmaintenance.pt', name: 'Admin', abbreviation: 'ADM', role: 'manager' },
    ]
    const matchedKnown = KNOWN_USERS.find((k) => k.id === session.uid || (userEmail && k.email.toLowerCase() === userEmail))
    return {
      id: matchedKnown?.id || session.uid,
      email: userEmail || matchedKnown?.email || '',
      name: matchedKnown?.name || session.name || (isRGAdmin ? 'Rui Garrido' : 'Utilizador'),
      abbreviation: matchedKnown?.abbreviation || (isRGAdmin ? 'RG' : null),
      role: isRGAdmin ? 'manager' : (matchedKnown?.role || 'technician'),
      companyId: DEMO_COMPANY_ID,
      company: {
        id: DEMO_COMPANY_ID,
        name: 'Empresa UR',
        plan: 'enterprise',
        activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history', 'messages'],
        aiCredits: 100,
      },
    } as UserProfile
  }
})
