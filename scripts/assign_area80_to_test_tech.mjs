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
  console.log('=== ATRIBUIR OTS DA ÁREA 80 AO TÉCNICO DE TESTE (RG - RuiG) ===')

  // Obter todos os assets da área 80
  const assetsSnap = await db.collection('assets').get()
  const area80AssetIds = new Set()
  assetsSnap.docs.forEach(d => {
    const a = d.data()
    if ((a.area || '').toString().trim() === '80') {
      area80AssetIds.add(d.id)
    }
  })
  console.log(`Encontrados ${area80AssetIds.size} equipamentos da Área 80.`)

  // Obter todas as tasks
  const tasksSnap = await db.collection('tasks').get()
  console.log(`Total de OTs na BD: ${tasksSnap.docs.length}`)

  let updatedCount = 0
  let batch = db.batch()
  let operationCounter = 0

  for (const d of tasksSnap.docs) {
    const t = d.data()
    const taskArea = (t.area || '').toString().trim()
    const isArea80 = taskArea === '80' || (t.assetId && area80AssetIds.has(t.assetId)) || (t.tag || '').startsWith('80')

    if (isArea80) {
      const docRef = db.collection('tasks').doc(d.id)
      batch.update(docRef, {
        assignedTo: 'RG',
        assignedToIds: ['mWSsTRtgq5QcOHusTdVYgDVrwHt2', 'RG'],
        updatedAt: new Date().toISOString()
      })
      updatedCount++
      operationCounter++

      if (operationCounter === 450) {
        await batch.commit()
        batch = db.batch()
        operationCounter = 0
      }
    }
  }

  if (operationCounter > 0) {
    await batch.commit()
  }

  console.log(`✓ SUCESSO: ${updatedCount} OTs da Área 80 foram atribuídas ao técnico de teste RG - RuiG (RG)!`)
}

run().catch(console.error)
