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

const companyId = 'rjHNaSUbLm4qTMyKP0oX'

async function run() {
  if (!getApps().length) {
    console.error('Firebase Admin não inicializado.')
    return
  }
  const db = getFirestore()

  console.log(`--- A ler scripts/import/assets.json ---`)
  const rawData = fs.readFileSync('scripts/import/assets.json', 'utf8')
  const jsonAssets = JSON.parse(rawData)
  console.log(`Total de equipamentos em assets.json: ${jsonAssets.length}`)

  // Verificar quantos existem no Firestore atualmente
  const existingSnap = await db.collection('assets').where('companyId', '==', companyId).get()
  console.log(`Equipamentos existentes na BD Firestore: ${existingSnap.docs.length}`)

  // Criar mapa de tags/nomes existentes para evitar duplicados
  const existingKeys = new Set(existingSnap.docs.map(d => {
    const data = d.data()
    return `${data.area || ''}_${data.tag || ''}_${data.name || ''}`.toLowerCase()
  }))

  const now = new Date().toISOString()
  let addedCount = 0
  let batch = db.batch()
  let operationCounter = 0

  for (let idx = 0; idx < jsonAssets.length; idx++) {
    const item = jsonAssets[idx]
    const key = `${item.area || ''}_${item.tag || ''}_${item.name || ''}`.toLowerCase()

    if (!existingKeys.has(key)) {
      const docRef = db.collection('assets').doc(`asset_ur_${idx + 1}`)
      batch.set(docRef, {
        companyId,
        area: item.area || null,
        tag: item.tag || null,
        system: item.system || null,
        name: item.name || 'Equipamento',
        characteristics: item.characteristics || null,
        manufacturer: item.manufacturer || null,
        notes: item.notes || null,
        criticidadeABC: item.criticidadeABC || null,
        active: true,
        createdAt: now,
      }, { merge: true })

      addedCount++
      operationCounter++

      if (operationCounter === 450) {
        await batch.commit()
        batch = db.batch()
        operationCounter = 0
        console.log(`- Batch de 450 submetido...`)
      }
    }
  }

  if (operationCounter > 0) {
    await batch.commit()
  }

  console.log(`--- IMPORTAÇÃO CONCLUÍDA: ${addedCount} novos equipamentos inseridos na BD! ---`)
  const finalSnap = await db.collection('assets').where('companyId', '==', companyId).get()
  console.log(`Total final de equipamentos na BD: ${finalSnap.docs.length}`)
}

run().catch(console.error)
