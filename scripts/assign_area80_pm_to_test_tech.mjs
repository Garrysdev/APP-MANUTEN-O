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

const db = getFirestore()

async function main() {
  const techId = 'mWSsTRtgq5QcOHusTdVYgDVrwHt2'
  const techName = 'RG - RuiG'
  console.log(`Using technician: ${techName} (${techId})`)

  const companyIds = ['rjHNaSUbLm4qTMyKP0oX', 'TGuw9zv7tUhB2cUPcysC']
  let totalAssigned = 0

  for (const companyId of companyIds) {
    console.log(`Querying Area 80 tasks for company ${companyId}...`)
    let snap
    try {
      snap = await db.collection('tasks').where('companyId', '==', companyId).where('area', '==', '80').get()
    } catch {
      snap = await db.collection('tasks').where('companyId', '==', companyId).limit(100).get()
    }

    const batch = db.batch()
    let batchCount = 0

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data()
      const taskArea = String(data.area || '').trim()
      const isArea80 = taskArea === '80' || (data.title || '').includes('Area 80') || (data.description || '').includes('Area 80')

      if (isArea80) {
        batch.update(docSnap.ref, {
          assignedTo: techId,
          assignedToIds: [techId],
          updatedAt: new Date().toISOString(),
        })
        batchCount++
        totalAssigned++
      }
    })

    if (batchCount > 0) {
      await batch.commit()
      console.log(`Atribuídas ${batchCount} OTs da Área 80 na empresa ${companyId}`)
    }
  }

  console.log(`Concluído! Total de OTs da Área 80 atribuídas ao técnico ${techName}: ${totalAssigned}`)
}

main().catch(console.error)
