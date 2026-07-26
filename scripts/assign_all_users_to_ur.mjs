import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

const UR_COMPANY_ID = 'rjHNaSUbLm4qTMyKP0oX'

async function main() {
  console.log('=== ATRIBUINDO TODAS AS CONTAS À EMPRESA REAL UR ===')
  const usersSnap = await db.collection('users').get()
  
  for (const uDoc of usersSnap.docs) {
    const data = uDoc.data()
    console.log(`Atualizando utilizador ${data.email} (${data.name}) para a empresa UR...`)
    await uDoc.ref.update({
      companyId: UR_COMPANY_ID,
      role: 'manager'
    })
  }

  // Garantir plano Enterprise na empresa UR
  await db.collection('companies').doc(UR_COMPANY_ID).set({
    name: 'UR - Manutenção Industrial',
    plan: 'enterprise',
    maxTechnicians: 100,
    active: true,
    updatedAt: new Date().toISOString(),
  }, { merge: true })

  console.log('✅ TODAS AS CONTAS DE UTILIZADOR FORAM VINCULADAS À EMPRESA UR!')
}

main().catch(console.error)
