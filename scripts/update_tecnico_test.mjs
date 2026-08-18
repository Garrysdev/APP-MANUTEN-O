import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import fs from 'fs'
import path from 'path'

// Ler .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  }
}

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length && projectId && clientEmail && privateKey) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

async function run() {
  if (!getApps().length) {
    console.log('Firebase não inicializado (sem credenciais em .env.local).')
    return
  }
  const db = getFirestore()
  const snap = await db.collection('users').where('email', '==', 'tecnico@teste.rg').get()
  if (!snap.empty) {
    for (const doc of snap.docs) {
      await doc.ref.update({
        name: 'Marco Silva',
        abbreviation: 'MS',
        role: 'technician',
        active: true
      })
      console.log(`Documento do utilizador ${doc.id} atualizado para Marco Silva (MS)`)
    }
  } else {
    console.log('Nenhum doc Firestore encontrado com tecnico@teste.rg, os fallbacks tomarão conta.')
  }
}

run().catch(console.error)
