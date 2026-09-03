/**
 * Importa os artigos de scripts/import/stocks.json para a coleção stock_items da
 * Firestore, aplicando exactamente o mesmo mapeamento que getFallbackStockItems()
 * usa em src/lib/firebase/data.ts — para o que passa a estar na base de dados ser
 * igual ao que a app já mostrava a partir do ficheiro de reserva.
 *
 * Idempotente: usa o id do próprio artigo como id do documento (set), por isso
 * correr duas vezes não duplica nada.
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import fs from 'fs'
import path from 'path'

for (const line of fs.readFileSync(process.cwd() + '/.env.local', 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i > 0) {
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    process.env[t.slice(0, i).trim()] = v
  }
}
if (!getApps().length) initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
})})

const COMPANY_ID = 'rjHNaSUbLm4qTMyKP0oX'
const db = getFirestore()

const raw = fs.readFileSync(path.join(process.cwd(), 'scripts', 'import', 'stocks.json'), 'utf-8')
const json = JSON.parse(raw)

const existing = await db.collection('stock_items').where('companyId', '==', COMPANY_ID).get()
console.log('Artigos já na Firestore antes de importar:', existing.size)

let batch = db.batch()
let ops = 0
let written = 0

for (const [idx, item] of json.entries()) {
  const id = item.id || `stock_item_${idx + 1}`
  const doc = {
    companyId: COMPANY_ID,
    code: item.code || item.reference || `STOCK-${idx + 1}`,
    name: item.name || 'Artigo de Consumo',
    category: item.category || 'Consumíveis',
    unit: item.unit || 'un',
    quantity: 0,
    minQuantity: item.minQuantity ?? 1,
    location: item.location || 'Armazém UR',
    cost: item.unitCost || item.cost || 0,
    unitCost: item.unitCost || item.cost || 0,
    area: item.area || null,
    tag: item.tag || null,
    system: item.system || null,
    description: item.description || null,
    supplier: item.supplier || null,
    // Sem equipamento associado à partida: os 234 artigos não trazem essa informação.
    // Fica a null para não inventar ligações; a associação faz-se ao usá-los numa OT.
    assetId: item.assetId || null,
    assetIds: item.assetIds || null,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  batch.set(db.collection('stock_items').doc(id), doc)
  ops++
  written++
  if (ops >= 400) {
    await batch.commit()
    batch = db.batch()
    ops = 0
  }
}
if (ops > 0) await batch.commit()

const after = await db.collection('stock_items').where('companyId', '==', COMPANY_ID).get()
console.log('Escritos:', written)
console.log('Artigos na Firestore depois de importar:', after.size)
