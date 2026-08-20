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

  const userEmail = (session.email || '').toLowerCase().trim()
  const isRGAdmin = userEmail === 'garrido.rui@gmail.com'

  try {
    const db = adminDb()
    const userSnap = await db.collection('users').doc(session.uid).get()
    if (!userSnap.exists) {
      // Se for a conta admin de teste, mantém a empresa de teste rjHNaSUbLm4qTMyKP0oX
      const targetCompanyId = isRGAdmin ? 'rjHNaSUbLm4qTMyKP0oX' : (session.companyId || `company_${session.uid}`)
      return {
        id: session.uid,
        email: session.email || '',
        name: session.name || 'Utilizador',
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
          name: isRGAdmin ? 'Empresa UR' : 'Minha Empresa',
          plan: 'starter',
          activeModules: userRole === 'technician' ? ['tasks', 'assets', 'history'] : ['tasks', 'assets', 'maintenance_plan', 'stocks', 'history'],
          aiCredits: 100
        }
      }
    }
    return user
  } catch (err: any) {
    console.error('[getCurrentProfile] Firestore query error:', err?.message || err)
    const targetCompanyId = isRGAdmin ? 'rjHNaSUbLm4qTMyKP0oX' : (session.companyId || `company_${session.uid}`)
    return {
      id: session.uid,
      email: session.email || '',
      name: session.name || 'Utilizador',
      role: isRGAdmin ? 'manager' : 'manager',
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
