import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

async function check() {
  const usersSnap = await db.collection('users').get()
  console.log('=== LISTA COMPLETA DE UTILIZADORES ===')
  for (const doc of usersSnap.docs) {
    const u = doc.data()
    let cName = 'Sem empresa'
    if (u.companyId) {
      const cDoc = await db.collection('companies').doc(u.companyId).get()
      if (cDoc.exists) cName = cDoc.data()?.name ?? u.companyId
    }
    console.log(`UID: ${doc.id} | Email: "${u.email}" | Nome: "${u.name}" | Empresa: "${cName}" (${u.companyId})`)
  }
}

check().catch(console.error)
