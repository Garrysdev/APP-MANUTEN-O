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

  const uSnap = await db.collection('users').get()
  console.log('=== USERS ===')
  for (const d of uSnap.docs) {
    const u = d.data()
    console.log(`ID: ${d.id} | Email: ${u.email} | Name: ${u.name} | CompanyId: ${u.companyId} | Role: ${u.role} | Active: ${u.active}`)
  }

  const cSnap = await db.collection('companies').get()
  console.log('\n=== COMPANIES ===')
  for (const d of cSnap.docs) {
    const c = d.data()
    console.log(`ID: ${d.id} | Name: ${c.name} | Code: ${c.code}`)
  }

  const aSnap = await db.collection('assets').get()
  console.log('\n=== ASSETS COUNT BY COMPANY ===')
  const counts = {}
  for (const d of aSnap.docs) {
    const cid = d.data().companyId || 'SEM_COMPANY'
    counts[cid] = (counts[cid] || 0) + 1
  }
  console.log(counts)
}

run().catch(console.error)
