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
  console.log('=== FIXING COMPANY ALIGNMENT & ASSETS ===')

  // 1. Atualizar utilizador de teste do técnico (tecnico@teste.rg) para rjHNaSUbLm4qTMyKP0oX
  const techRef = db.collection('users').doc('mWSsTRtgq5QcOHusTdVYgDVrwHt2')
  await techRef.set({
    companyId: 'rjHNaSUbLm4qTMyKP0oX',
    name: 'RG - RuiG',
    abbreviation: 'RG',
    role: 'technician',
    active: true,
    email: 'tecnico@teste.rg'
  }, { merge: true })
  console.log('✓ Técnico de teste (tecnico@teste.rg) atualizado para companyId: rjHNaSUbLm4qTMyKP0oX (RG - RuiG)')

  // 2. Atualizar enterprise@teste.rg para a mesma companyId
  const entRef = db.collection('users').doc('ue15A4DcVMRbstIEhrkny5Be42G3')
  await entRef.set({
    companyId: 'rjHNaSUbLm4qTMyKP0oX',
    active: true
  }, { merge: true })
  console.log('✓ Utilizador enterprise@teste.rg alinhado com companyId: rjHNaSUbLm4qTMyKP0oX')

  // 3. Garantir que os 895 equipamentos estão presentes em rjHNaSUbLm4qTMyKP0oX e TGuw9zv7tUhB2cUPcysC
  const rawData = fs.readFileSync('scripts/import/assets.json', 'utf8')
  const jsonAssets = JSON.parse(rawData)
  console.log(`Total de equipamentos a sincronizar: ${jsonAssets.length}`)

  const targetCompanies = ['rjHNaSUbLm4qTMyKP0oX', 'TGuw9zv7tUhB2cUPcysC']

  for (const cid of targetCompanies) {
    const existingSnap = await db.collection('assets').where('companyId', '==', cid).get()
    console.log(`Company ${cid}: atualmente tem ${existingSnap.docs.length} equipamentos`)

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
    console.log(`✓ Company ${cid}: adicionados ${added} novos equipamentos! Total final: ${existingSnap.docs.length + added}`)
  }

  console.log('=== CONCLUÍDO COM SUCESSO! ===')
}

run().catch(console.error)
