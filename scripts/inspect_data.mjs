import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import fs from 'fs'
import path from 'path'

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
  const db = getFirestore()
  const companyId = 'rjHNaSUbLm4qTMyKP0oX'

  const [tasksSnap, ivSnap] = await Promise.all([
    db.collection('tasks').where('companyId', '==', companyId).get(),
    db.collection('interventions').where('companyId', '==', companyId).get(),
  ])

  console.log('Sample task[0]:', tasksSnap.docs[0]?.data())
  console.log('Sample task[1]:', tasksSnap.docs[1]?.data())

  const ivs = ivSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log('Sample intervention[0]:', ivs[0])
  console.log('Sample intervention[1]:', ivs[1])
}

run().catch(console.error)
