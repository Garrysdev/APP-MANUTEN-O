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

function parseExcelDate(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'number') {
    const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000))
    return jsDate.toISOString()
  }
  const str = String(val).trim()
  if (!str || str === '0x7' || str === '0x17') return null
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed.toISOString()
  return str
}

function mapTItoTipo(tiRaw) {
  if (!tiRaw) return { tipoText: null, tipo: null }
  const ti = String(tiRaw).trim().toUpperCase()
  if (ti === 'MI') return { tipoText: 'MI', tipo: 'melhoria' }
  if (ti === 'MC') return { tipoText: 'MC', tipo: 'curativa' }
  if (ti === 'PI') return { tipoText: 'PI', tipo: 'pi' }
  if (ti === 'PM') return { tipoText: 'PM', tipo: 'preventiva' }
  if (ti === 'STP') return { tipoText: 'STP', tipo: 'preventiva' }
  if (ti === 'PR') return { tipoText: 'PR', tipo: 'plano' }
  return { tipoText: ti, tipo: null }
}

async function run() {
  const db = getFirestore()
  const filePath = 'G:\\_CLAUDE 2026\\02. RG MAINTENANCE\\FR-MAN-09 MANUTENÇÃO_05_01_2026_8.xlsb'

  console.log('=== IMPORTAR DATAS E COLUNA TI DA FOLHA UR NO FIRESTORE ===')
  const workbook = xlsx.readFile(filePath, { cellDates: true })
  const sheet = workbook.Sheets['UR']
  if (!sheet) {
    console.error('Folha UR não encontrada!')
    process.exit(1)
  }

  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 })
  console.log(`Total de linhas na folha UR: ${rows.length}`)

  const excelTasksMap = new Map()

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const idVal = row[0] ? String(row[0]).trim() : null
    const dataVal = row[3] ? parseExcelDate(row[3]) : null
    const tag = row[5] ? String(row[5]).trim() : ''
    const tiVal = row[6] ? String(row[6]).trim() : null
    const title = row[7] ? String(row[7]).trim() : ''
    const inicioVal = row[9] ? parseExcelDate(row[9]) : null
    const fimVal = row[10] ? parseExcelDate(row[10]) : null
    const causaObs = row[11] ? String(row[11]).trim() : null

    if (idVal || tag || title) {
      const tiMapped = mapTItoTipo(tiVal)
      const dataObj = {
        data: dataVal,
        inicio: inicioVal,
        fim: fimVal,
        ti: tiVal,
        tipoText: tiMapped.tipoText,
        tipo: tiMapped.tipo,
        causaObs: causaObs,
      }

      if (idVal) excelTasksMap.set(idVal, dataObj)
      if (tag && title) excelTasksMap.set(`${tag}__${title}`.toLowerCase(), dataObj)
    }
  }

  console.log(`Mapeadas ${excelTasksMap.size} tarefas do Excel com TI e datas.`)

  const companyIds = ['rjHNaSUbLm4qTMyKP0oX', 'TGuw9zv7tUhB2cUPcysC']
  let updatedCount = 0

  for (const cid of companyIds) {
    const tasksSnap = await db.collection('tasks').where('companyId', '==', cid).get()
    let batch = db.batch()
    let opCounter = 0

    for (const doc of tasksSnap.docs) {
      const t = doc.data()
      const sourceId = t.sourceId ? String(t.sourceId).trim() : null
      const docId = doc.id
      const keyTagTitle = `${t.tag || ''}__${t.title || ''}`.toLowerCase()

      const matched = (sourceId && excelTasksMap.get(sourceId)) ||
                      excelTasksMap.get(docId) ||
                      excelTasksMap.get(keyTagTitle)

      if (matched) {
        const updates = {}
        if (matched.data) updates.createdAt = matched.data
        if (matched.inicio) updates.plannedStartDate = matched.inicio
        if (matched.fim) updates.completedAt = matched.fim
        if (matched.ti) updates.ti = matched.ti
        if (matched.tipoText) updates.tipoText = matched.tipoText
        if (matched.tipo) updates.tipo = matched.tipo
        if (matched.causaObs && !t.observations) updates.observations = matched.causaObs

        if (Object.keys(updates).length > 0) {
          batch.update(doc.ref, updates)
          updatedCount++
          opCounter++

          if (opCounter === 400) {
            await batch.commit()
            batch = db.batch()
            opCounter = 0
          }
        }
      }
    }

    if (opCounter > 0) {
      await batch.commit()
    }
  }

  console.log(`✓ SUCESSO: ${updatedCount} tarefas atualizadas no Firestore com a coluna TI, DATA, INÍCIO e FIM!`)
}

run().catch(console.error)
