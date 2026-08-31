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

    if (!userSnap.exists) {
      const targetCompanyId = (session as any).companyId || DEMO_COMPANY_ID
      const fallbackRole = isRGAdmin ? 'manager' : 'technician'
      return {
        id: session.uid,
        email: session.email || '',
        name: session.name || 'Utilizador',
        role: fallbackRole,
        companyId: targetCompanyId,
        company: {
          id: targetCompanyId,
          name: 'Empresa UR',
          plan: 'enterprise',
          activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
          aiCredits: 100
        }
      } as UserProfile
    }

    const docData = userSnap.data() || {}
    const rawRole = (docData.role as string)?.toLowerCase()?.trim()
    const userRole = (rawRole === 'technician' || rawRole === 'tecnico' || rawRole === 'técnico' || rawRole === 'tech') ? 'technician' : 'manager'

    const companyId = docData.companyId || DEMO_COMPANY_ID

    const user = { 
      id: userSnap.id, 
      ...docData, 
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
        activeModules: c.activeModules || ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
        aiCredits: c.aiCredits || 100 
      }
    } else {
      user.company = {
        id: companyId,
        name: isRGAdmin ? 'Empresa UR' : 'Minha Empresa',
        plan: (isRGAdmin || companyId === DEMO_COMPANY_ID) ? 'enterprise' : 'starter',
        activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
        aiCredits: 100
      }
    }

    return user
  } catch (err: any) {
    const isQuotaErr = String(err?.message || err).includes('Quota exceeded') || String(err?.message || err).includes('RESOURCE_EXHAUSTED')
    if (isQuotaErr) {
      console.warn('[getCurrentProfile] Quota do Firestore atingida. A usar perfil de sessão local.')
    } else {
      console.error('[getCurrentProfile] Firestore query error:', err?.message || err)
    }
    const targetCompanyId = isRGAdmin ? DEMO_COMPANY_ID : ((session as any).companyId || DEMO_COMPANY_ID)
    const fallbackRole = isRGAdmin ? 'manager' : 'technician'
    return {
      id: session.uid,
      email: session.email || '',
      name: session.name || 'Utilizador',
      role: fallbackRole,
      companyId: targetCompanyId,
      company: {
        id: targetCompanyId,
        name: isRGAdmin ? 'Empresa UR' : 'Minha Empresa',
        plan: (isRGAdmin || targetCompanyId === DEMO_COMPANY_ID) ? 'enterprise' : 'starter',
        activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
        aiCredits: 100
      }
    } as UserProfile
  }
})
