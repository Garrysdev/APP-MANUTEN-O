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

const DEFAULT_ASSETS = [
  { id: '80', name: 'Área 80 - Extrusora 80', area: '80', tag: '80' },
  { id: '120B', name: 'Área 120B - Linha 120B', area: '120B', tag: '120B' },
  { id: '121B', name: 'Área 121B - Linha 121B', area: '121B', tag: '121B' },
  { id: '122B', name: 'Área 122B - Linha 122B', area: '122B', tag: '122B' },
  { id: '130', name: 'Área 130 - Impressão 130', area: '130', tag: '130' },
  { id: '130EST', name: 'Área 130EST - Estiramento 130', area: '130EST', tag: '130EST' },
  { id: '130INK', name: 'Área 130INK - Tintas 130', area: '130INK', tag: '130INK' },
  { id: 'SR', name: 'Área SR - Reifenhauser SR', area: 'SR', tag: 'SR' },
  { id: 'VT', name: 'Área VT - Edifício VT', area: 'VT', tag: 'VT' },
  { id: 'UR', name: 'Área UR - Utilidades & Serviços', area: 'UR', tag: 'UR' },
  { id: 'Geral', name: 'Serviços Gerais / Transversal', area: 'Geral', tag: 'Geral' },
]

async function run() {
  const db = getFirestore()
  console.log('=== NORMALIZAÇÃO E PREENCHIMENTO DO CAMPO ASSETID EM TODAS AS OTs ===')

  const companiesSnap = await db.collection('companies').get()
  const companyIds = companiesSnap.docs.map(d => d.id)
  if (!companyIds.includes('rjHNaSUbLm4qTMyKP0oX')) companyIds.push('rjHNaSUbLm4qTMyKP0oX')
  if (!companyIds.includes('TGuw9zv7tUhB2cUPcysC')) companyIds.push('TGuw9zv7tUhB2cUPcysC')

  let totalUpdated = 0
  let totalCreatedAssets = 0

  for (const companyId of companyIds) {
    // 1. Carregar Assets existentes
    const assetsSnap = await db.collection('assets').where('companyId', '==', companyId).get()
    const assetsMap = new Map()
    const tagMap = new Map()

    assetsSnap.docs.forEach(doc => {
      const a = doc.data()
      const item = { id: doc.id, name: a.name || doc.id, area: a.area || 'Geral', tag: a.tag || doc.id }
      assetsMap.set(doc.id, item)
      if (a.tag) tagMap.set(a.tag.toLowerCase().trim(), item)
    })

    // Se a coleção de assets da empresa estiver vazia, criar os assets padrão no Firestore
    if (assetsSnap.empty) {
      console.log(`Empresa ${companyId}: A popular 11 assets padrão no Firestore...`)
      for (const def of DEFAULT_ASSETS) {
        const assetRef = db.collection('assets').doc(def.id)
        await assetRef.set({
          id: def.id,
          companyId,
          name: def.name,
          area: def.area,
          tag: def.tag,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, { merge: true })

        const item = { id: def.id, name: def.name, area: def.area, tag: def.tag }
        assetsMap.set(def.id, item)
        tagMap.set(def.tag.toLowerCase().trim(), item)
        totalCreatedAssets++
      }
    }

    // 2. Carregar OTs / Tarefas da empresa
    const tasksSnap = await db.collection('tasks').where('companyId', '==', companyId).get()
    console.log(`Empresa ${companyId}: ${tasksSnap.size} tarefas encontradas.`)

    let batch = db.batch()
    let opCounter = 0

    for (const doc of tasksSnap.docs) {
      const t = doc.data()
      const currentAssetId = t.assetId ? String(t.assetId).trim() : ''
      const currentTag = t.tag ? String(t.tag).trim() : ''
      const currentArea = t.area ? String(t.area).trim() : ''

      let resolvedAsset = null

      // Tentar encontrar asset por assetId
      if (currentAssetId && assetsMap.has(currentAssetId)) {
        resolvedAsset = assetsMap.get(currentAssetId)
      }

      // Tentar encontrar asset por tag
      if (!resolvedAsset && currentTag && tagMap.has(currentTag.toLowerCase())) {
        resolvedAsset = tagMap.get(currentTag.toLowerCase())
      }

      // Tentar encontrar asset por area
      if (!resolvedAsset && currentArea && tagMap.has(currentArea.toLowerCase())) {
        resolvedAsset = tagMap.get(currentArea.toLowerCase())
      }

      // Se ainda não encontrou, resolver assetId sintético (ex: usar a tag ou área)
      const finalAssetId = String(resolvedAsset?.id || currentAssetId || currentTag || currentArea || 'Geral').trim()
      const finalTag = String(resolvedAsset?.tag || currentTag || finalAssetId).trim()
      const finalArea = String(resolvedAsset?.area || currentArea || 'Geral').trim()

      // Verificar se a tarefa precisa de ser atualizada
      if (t.assetId !== finalAssetId || t.tag !== finalTag || t.area !== finalArea) {
        batch.update(doc.ref, {
          assetId: finalAssetId,
          tag: finalTag,
          area: finalArea,
          updatedAt: new Date().toISOString(),
        })

        totalUpdated++
        opCounter++

        if (opCounter === 400) {
          await batch.commit()
          batch = db.batch()
          opCounter = 0
        }
      }
    }

    if (opCounter > 0) {
      await batch.commit()
    }
  }

  console.log(`✓ CONCLUÍDO COM SUCESSO:`)
  console.log(`- Assets padrão criados/garantidos: ${totalCreatedAssets}`)
  console.log(`- Tarefas / OTs atualizadas com assetId preenchido: ${totalUpdated}`)
}

run().catch(console.error)
