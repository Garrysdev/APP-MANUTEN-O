import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import fs from 'fs'

const envPath = process.cwd() + '/.env.local'
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      process.env[key] = val
    }
  }
}
const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })

const DEMO_COMPANY_ID = 'rjHNaSUbLm4qTMyKP0oX'
const SOURCES = ['pm_anual_paragem_verao_2026', 'pm_agendamento_2026']

async function run() {
  const db = getFirestore()
  let batch = db.batch()
  let ops = 0
  let fixed = 0

  for (const source of SOURCES) {
    const snap = await db.collection('tasks').where('companyId', '==', DEMO_COMPANY_ID).where('source', '==', source).get()
    console.log(source, '->', snap.size, 'docs')
    for (const doc of snap.docs) {
      const t = doc.data()
      const createdAtIsTimestamp = t.createdAt && typeof t.createdAt.toDate === 'function'
      const updatedAtIsTimestamp = t.updatedAt && typeof t.updatedAt.toDate === 'function'
      if (!createdAtIsTimestamp && !updatedAtIsTimestamp) continue

      const createdIso = createdAtIsTimestamp ? t.createdAt.toDate().toISOString() : t.createdAt
      const updatedIso = updatedAtIsTimestamp ? t.updatedAt.toDate().toISOString() : t.updatedAt

      batch.update(doc.ref, { createdAt: createdIso, updatedAt: updatedIso })
      ops++
      fixed++
      if (ops >= 400) {
        await batch.commit()
        batch = db.batch()
        ops = 0
      }
    }
  }
  if (ops > 0) await batch.commit()
  console.log('FIXED:', fixed)
}

run().catch((e) => console.log('ERROR', e.code, e.message))
