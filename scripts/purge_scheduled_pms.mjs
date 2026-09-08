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

async function purge() {
  console.log('--- A INICIAR PURGA DE OTs DE PM AGENDADAS / FUTURAS ---')
  const todayIso = new Date().toISOString().slice(0, 10)
  console.log('Data de corte (hoje):', todayIso)

  const snap = await db.collection('tasks').get()
  console.log('Total de tarefas na BD antes da purga:', snap.size)

  const toDelete = []
  snap.docs.forEach((d) => {
    const data = d.data()
    const startDate = data.plannedStartDate || data.dueDate || data.createdAt
    const isFuture = startDate && startDate.slice(0, 10) > todayIso
    
    // Identificar OTs de PM em massa / agendadas futuras
    const isScheduledPM = Boolean(
      data.source === 'pm_agendamento_2026' ||
      data.source === 'plan' ||
      (data.title && (data.title.startsWith('[PM]') || data.title.startsWith('[MP]'))) ||
      (data.maintenancePlanId && data.status !== 'done') ||
      (isFuture && (data.tipo === 'preventiva' || data.tipo === 'mp' || data.tipo === 'pm' || data.tipo === 'plano'))
    )

    if (isScheduledPM) {
      toDelete.push({ id: d.id, title: data.title, ref: d.ref })
    }
  })

  console.log(`Tarefas de PM identificadas para eliminação: ${toDelete.length}`)

  const BATCH_SIZE = 400
  let deletedCount = 0
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const chunk = toDelete.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    chunk.forEach((item) => batch.delete(item.ref))
    await batch.commit()
    deletedCount += chunk.length
    console.log(`Progresso: ${deletedCount}/${toDelete.length} eliminadas...`)
  }

  const snapAfter = await db.collection('tasks').get()
  console.log('--- PURGA CONCLUÍDA COM SUCESSO ---')
  console.log('Total de tarefas restantes na BD:', snapAfter.size)
}

purge().catch(console.error)
