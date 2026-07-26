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

/** Devolve o perfil completo (user + company) do utilizador autenticado, ou null. */
export const getCurrentProfile = cache(async function (): Promise<UserProfile | null> {
  const session = await getSessionUser().catch(() => null)
  if (!session) return null

  try {
    const db = adminDb()
    const userSnap = await db.collection('users').doc(session.uid).get()
    if (!userSnap.exists) {
      // Perfil fallback se o doc do utilizador não existir no Firestore
      return {
        id: session.uid,
        email: session.email || 'user@rgmaintenance.pt',
        name: session.name || session.email?.split('@')[0] || 'Utilizador',
        role: 'manager',
        companyId: 'rjHNaSUbLm4qTMyKP0oX',
        company: {
          id: 'rjHNaSUbLm4qTMyKP0oX',
          name: 'Empresa UR',
          plan: 'enterprise',
          activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
          aiCredits: 100
        }
      } as UserProfile
    }

    const user = { id: userSnap.id, ...userSnap.data() } as UserProfile
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
          activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
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
      name: session.name || 'Rui Garrido (UR)',
      role: 'manager',
      companyId: 'rjHNaSUbLm4qTMyKP0oX',
      company: {
        id: 'rjHNaSUbLm4qTMyKP0oX',
        name: 'Empresa UR',
        plan: 'enterprise',
        activeModules: ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
        aiCredits: 100
      }
    } as UserProfile
  }
})
