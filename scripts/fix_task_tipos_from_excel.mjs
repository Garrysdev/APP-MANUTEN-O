import xlsx from 'xlsx'
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

function parseTiCode(raw) {
  if (!raw) return 'mc'
  const str = String(raw).trim().toLowerCase()
  if (str === 'pi') return 'pi'
  if (str === 'mc') return 'mc'
  if (str === 'mp' || str === 'pm' || str.includes('preventiva')) return 'preventiva'
  if (str === 'stp') return 'stp'
  if (str === 'ins') return 'inspecao'
  if (str === 'lub') return 'lubrificacao'
  if (str === 'cal') return 'calibracao'
  return str
}

async function run() {
  const db = getFirestore()
  const companyId = 'rjHNaSUbLm4qTMyKP0oX'

  const excelPath = 'G:\\_CLAUDE 2026\\02. RG MAINTENANCE\\FR-MAN-09 MANUTENÇÃO_05_01_2026_8.xlsb'
  if (!fs.existsSync(excelPath)) {
    console.error('Excel file not found:', excelPath)
    return
  }

  const wb = xlsx.readFile(excelPath, { cellDates: true })
  const sheet = wb.Sheets['UR'] || wb.Sheets[wb.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' })
  console.log(`Excel lido com sucesso: ${rows.length} linhas.`)

  // Carregar todas as tarefas da empresa
  const tasksSnap = await db.collection('tasks').where('companyId', '==', companyId).get()
  const tasks = tasksSnap.docs.map(d => ({ docId: d.id, ...d.data() }))

  let updatedCount = 0
  let batch = db.batch()
  let opCounter = 0

  for (const row of rows) {
    const avaria = String(row['AVARIA'] || row['Avaria'] || row['DESCRIÇÃO'] || '').trim()
    const tag = String(row['TAG'] || row['Tag'] || '').trim()
    const tiRaw = String(row['TI'] || row['Tipo'] || '').trim()
    const parsedTipo = parseTiCode(tiRaw)

    if (!avaria) continue

    // Encontrar tarefa correspondente em Firestore
    const matchedTask = tasks.find(t => {
      const tTitle = String(t.title || '').trim().toLowerCase()
      const tTag = String(t.tag || t.assetId || '').trim().toLowerCase()
      return tTitle === avaria.toLowerCase() || (tTag && tag && tTag === tag.toLowerCase() && tTitle.includes(avaria.slice(0, 15).toLowerCase()))
    })

    if (matchedTask && matchedTask.tipo !== parsedTipo) {
      const ref = db.collection('tasks').doc(matchedTask.docId)
      batch.update(ref, {
        tipo: parsedTipo,
        updatedAt: new Date().toISOString(),
      })
      updatedCount++
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

  console.log(`✓ SUCESSO: ${updatedCount} tarefas atualizadas com o Tipo de Intervenção (TI) real do Excel!`)

  // Contagem atualizada dos tipos de tarefa
  const newTasksSnap = await db.collection('tasks').where('companyId', '==', companyId).get()
  const newTiposMap = {}
  newTasksSnap.docs.forEach(d => {
    const tp = String(d.data().tipo || 'unknown').toLowerCase()
    newTiposMap[tp] = (newTiposMap[tp] || 0) + 1
  })
  console.log('Novos tipos de tarefa em Firestore:', newTiposMap)
}

run().catch(console.error)
