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
  const session = await getSessionUser()
  if (!session) return null

  const db = adminDb()
  const userSnap = await db.collection('users').doc(session.uid).get()
  if (!userSnap.exists) return null
  const user = { id: userSnap.id, ...userSnap.data() } as UserProfile
  if (user.active === false) return null

  if (user.companyId) {
    const companySnap = await db.collection('companies').doc(user.companyId).get()
    if (companySnap.exists) {
      const c = companySnap.data()!
      user.company = { 
        id: companySnap.id, 
        name: c.name, 
        plan: c.plan, 
        activeModules: c.activeModules || [],
        aiCredits: c.aiCredits || 0 
      }
    }
  }
  return user
})
