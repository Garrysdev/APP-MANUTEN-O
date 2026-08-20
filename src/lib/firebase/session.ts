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
  const isRGAdmin = userEmail.includes('garrido.rui') || userEmail.includes('garrido') || userEmail.includes('rgmaintenance') || !userEmail

  try {
    const db = adminDb()
    const userSnap = await db.collection('users').doc(session.uid).get()
    
    if (!userSnap.exists) {
      const targetCompanyId = isRGAdmin ? DEMO_COMPANY_ID : (session.companyId || `company_${session.uid}`)
      return {
        id: session.uid,
        email: session.email || '',
        name: session.name || 'Rui Garrido',
        role: 'manager',
        companyId: targetCompanyId,
        company: {
          id: targetCompanyId,
          name: isRGAdmin ? 'Empresa UR' : 'Minha Empresa',
          plan: 'starter',
          activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
          aiCredits: 100
        }
      } as UserProfile
    }

    const docData = userSnap.data() || {}
    const rawRole = (docData.role as string)?.toLowerCase()?.trim()
    const userRole = isRGAdmin ? 'manager' : ((rawRole === 'technician' || rawRole === 'tecnico' || rawRole === 'tech') ? 'technician' : 'manager')

    // Garantir que a conta admin (garrido.rui) ou utilizadores sem empresa usam a Empresa UR por defeito
    const companyId = isRGAdmin ? DEMO_COMPANY_ID : (docData.companyId || DEMO_COMPANY_ID)

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
        plan: c.plan || 'starter', 
        activeModules: c.activeModules && c.activeModules.length > 0 ? c.activeModules : ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
        aiCredits: c.aiCredits || 100 
      }
    } else {
      user.company = {
        id: companyId,
        name: isRGAdmin ? 'Empresa UR' : 'Minha Empresa',
        plan: 'starter',
        activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
        aiCredits: 100
      }
    }

    return user
  } catch (err: any) {
    console.error('[getCurrentProfile] Firestore query error:', err?.message || err)
    const targetCompanyId = isRGAdmin ? DEMO_COMPANY_ID : (session.companyId || DEMO_COMPANY_ID)
    return {
      id: session.uid,
      email: session.email || '',
      name: session.name || 'Rui Garrido',
      role: 'manager',
      companyId: targetCompanyId,
      company: {
        id: targetCompanyId,
        name: isRGAdmin ? 'Empresa UR' : 'Minha Empresa',
        plan: 'starter',
        activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
        aiCredits: 100
      }
    } as UserProfile
  }
})
