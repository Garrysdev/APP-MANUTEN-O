// Helpers de sessão no servidor. Lê o cookie de sessão Firebase, verifica-o com o
// Admin SDK e devolve o perfil do utilizador (com a empresa) a partir do Firestore.
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from './admin'
import type { UserProfile } from '@/types/models'

export const SESSION_COOKIE = '__session'

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

function isTechnicianEmail(email?: string | null): boolean {
  if (!email) return false
  const e = email.toLowerCase().trim()
  return (
    e.includes('tecnico') ||
    e.includes('tech') ||
    e === 'lm@rgmaintenance.pt' ||
    e === 'li@rgmaintenance.pt' ||
    e === 'mc@rgmaintenance.pt' ||
    e === 'jc@rgmaintenance.pt' ||
    e === 'ms@rgmaintenance.pt' ||
    e === 'cb@rgmaintenance.pt' ||
    e === 'ur@rgmaintenance.pt' ||
    e === 'ox2@rgmaintenance.pt' ||
    e === 'blockcontrol@rgmaintenance.pt' ||
    e === 'carrier@rgmaintenance.pt' ||
    e === 'schindler@rgmaintenance.pt' ||
    e === 'helenos@rgmaintenance.pt'
  )
}

/** Devolve o perfil completo (user + company) do utilizador autenticado, ou null. */
export const getCurrentProfile = cache(async function (): Promise<UserProfile | null> {
  const session = await getSessionUser().catch(() => null)
  if (!session) return null

  const isRGAdmin = session.email?.toLowerCase().trim() === 'garrido.rui@gmail.com'
  const isTech = !isRGAdmin && isTechnicianEmail(session.email)
  const defaultRole = isRGAdmin ? 'manager' : (isTech ? 'technician' : 'manager')

  try {
    const db = adminDb()
    const userSnap = await db.collection('users').doc(session.uid).get()
    if (!userSnap.exists) {
      // Perfil fallback se o doc do utilizador não existir no Firestore
      return {
        id: session.uid,
        email: session.email || 'garrido.rui@gmail.com',
        name: session.name || 'Rui Garrido (RG)',
        role: 'manager',
        companyId: 'rjHNaSUbLm4qTMyKP0oX',
        company: {
          id: 'rjHNaSUbLm4qTMyKP0oX',
          name: 'Empresa UR',
          plan: 'enterprise',
          activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history', 'compliance-iso', 'ai-consultant'],
          aiCredits: 9999
        }
      } as UserProfile
    }

    const docData = userSnap.data() || {}
    const rawRole = (docData.role as string)?.toLowerCase()?.trim()
    const userRole = isRGAdmin ? 'manager' : ((rawRole === 'technician' || rawRole === 'tecnico' || rawRole === 'tech' || isTech) ? 'technician' : 'manager')

    const user = { id: userSnap.id, ...docData, role: userRole } as UserProfile
    if (user.active === false) return null

    if (user.companyId) {
      const companySnap = await db.collection('companies').doc(user.companyId).get().catch(() => null)
      if (companySnap?.exists) {
        const c = companySnap.data()!
        user.company = { 
          id: companySnap.id, 
          name: c.name, 
          plan: c.plan, 
          activeModules: c.activeModules || [],
          aiCredits: c.aiCredits || 0 
        }
      } else {
        user.company = {
          id: user.companyId,
          name: 'Empresa UR',
          plan: 'enterprise',
          activeModules: userRole === 'technician' ? ['tasks', 'assets', 'history'] : ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
          aiCredits: 100
        }
      }
    }
    return user
  } catch (err: any) {
    console.error('[getCurrentProfile] Firestore query error (ex: Quota Exceeded):', err?.message || err)
    // Fallback de contingência se a quota Firestore tiver sido excedida
    return {
      id: session.uid,
      email: session.email || 'garrido.rui@gmail.com',
      name: session.name || 'Rui Garrido (RG)',
      role: isRGAdmin ? 'manager' : defaultRole,
      companyId: 'rjHNaSUbLm4qTMyKP0oX',
      company: {
        id: 'rjHNaSUbLm4qTMyKP0oX',
        name: 'Empresa UR',
        plan: 'enterprise',
        activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history', 'compliance-iso', 'ai-consultant'],
        aiCredits: 9999
      }
    } as UserProfile
  }
})
