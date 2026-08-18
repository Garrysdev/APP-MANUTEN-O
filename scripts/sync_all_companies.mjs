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
  console.log('=== SINCRONIZAR TODAS AS EMPRESAS COM EQUIPAMENTOS E TÉCNICO RG - RuiG ===')

  // Ler 895 assets
  const rawData = fs.readFileSync('scripts/import/assets.json', 'utf8')
  const jsonAssets = JSON.parse(rawData)

  // Todas as empresas existentes na BD
  const compSnap = await db.collection('companies').get()
  const companyIds = compSnap.docs.map(d => d.id)
  console.log(`Empresas encontradas na BD (${companyIds.length}):`, companyIds)

  // 1. Garantir que o técnico RG - RuiG existe em cada empresa
  for (const cid of companyIds) {
    const userDocId = `tech_RuiG_${cid}`
    await db.collection('users').doc(userDocId).set({
      companyId: cid,
      name: 'RG - RuiG',
      abbreviation: 'RG',
      role: 'technician',
      active: true,
      email: 'tecnico@teste.rg',
      updatedAt: new Date().toISOString()
    }, { merge: true })
    console.log(`✓ Técnico "RG - RuiG" garantido para a empresa: ${cid}`)
  }

  // 2. Garantir também que o utilizador principal tecnico@teste.rg (mWSsTRtgq5QcOHusTdVYgDVrwHt2) tem active: true e role: technician
  await db.collection('users').doc('mWSsTRtgq5QcOHusTdVYgDVrwHt2').set({
    name: 'RG - RuiG',
    abbreviation: 'RG',
    role: 'technician',
    active: true,
    companyId: 'rjHNaSUbLm4qTMyKP0oX'
  }, { merge: true })

  // 3. Sincronizar todos os 895 equipamentos para cada empresa
  for (const cid of companyIds) {
    const existingSnap = await db.collection('assets').where('companyId', '==', cid).get()
    const existingKeys = new Set(existingSnap.docs.map(d => {
      const data = d.data()
      return `${data.area || ''}_${data.tag || ''}_${data.name || ''}`.toLowerCase()
    }))

    const now = new Date().toISOString()
    let batch = db.batch()
    let count = 0
    let added = 0

    for (let idx = 0; idx < jsonAssets.length; idx++) {
      const item = jsonAssets[idx]
      const key = `${item.area || ''}_${item.tag || ''}_${item.name || ''}`.toLowerCase()

      if (!existingKeys.has(key)) {
        const docRef = db.collection('assets').doc(`asset_${cid}_${idx + 1}`)
        batch.set(docRef, {
          companyId: cid,
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
        added++
        count++

        if (count === 450) {
          await batch.commit()
          batch = db.batch()
          count = 0
        }
      }
    }

    if (count > 0) {
      await batch.commit()
    }
    console.log(`✓ Empresa ${cid}: adicionados ${added} equipamentos. Total: ${existingSnap.docs.length + added}`)
  }

  console.log('\n=== TUDO SINCRONIZADO COM SUCESSO! ===')
}

run().catch(console.error)
