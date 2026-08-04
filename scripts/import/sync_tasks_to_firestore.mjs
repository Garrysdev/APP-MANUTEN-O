import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Load .env.local manually if present
const envPath = join(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  const envText = readFileSync(envPath, 'utf-8')
  for (const line of envText.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const k = trimmed.slice(0, idx).trim()
      let v = trimmed.slice(idx + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (!process.env[k]) process.env[k] = v
    }
  }
}

const COMPANY_ID = 'rjHNaSUbLm4qTMyKP0oX'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ FIREBASE credentials missing in environment')
  process.exit(1)
}

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

async function syncTasks() {
  console.log("Fetching existing Firestore tasks for company...", COMPANY_ID)
  const snap = await db.collection('tasks').where('companyId', '==', COMPANY_ID).get()
  console.log(`Found ${snap.docs.length} existing tasks in Firestore. Deleting...`)
  
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch()
    for (const doc of snap.docs.slice(i, i + 400)) {
      batch.delete(doc.ref)
    }
    await batch.commit()
  }
  console.log("Cleared old tasks from Firestore.")

  const tasksJsonPath = join(process.cwd(), 'scripts', 'import', 'tasks.json')
  const rawTasks = readFileSync(tasksJsonPath, 'utf-8')
  const tasks = JSON.parse(rawTasks)
  console.log(`Writing ${tasks.length} clean tasks to Firestore...`)

  for (let i = 0; i < tasks.length; i += 400) {
    const batch = db.batch()
    for (const t of tasks.slice(i, i + 400)) {
      const ref = db.collection('tasks').doc(t.id)
      batch.set(ref, t)
    }
    await batch.commit()
  }

  const doneCount = tasks.filter(t => t.status === 'done').length
  const openCount = tasks.filter(t => t.status !== 'done').length
  console.log(`✅ Sync Complete! Total: ${tasks.length} tasks (Concluded in History: ${doneCount}, Open on OTs page: ${openCount})`)
}

syncTasks().catch(console.error)
