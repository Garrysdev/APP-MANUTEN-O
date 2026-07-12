// Firebase Admin SDK — só no servidor (Node runtime). Inicialização lazy para que
// o build não falhe quando as credenciais ainda não estão configuradas (Gate A1).
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
} from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // A private key vem do .env com \n escapados — repomos as quebras de linha.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin não configurado: faltam FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.'
    )
  }
  return { projectId, clientEmail, privateKey }
}

function getAdminApp(): App {
  if (getApps().length) return getApp()
  const { projectId, clientEmail, privateKey } = getServiceAccount()
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp())
}
