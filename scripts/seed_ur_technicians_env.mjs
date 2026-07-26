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

console.log('Project ID:', projectId)
console.log('Client Email:', clientEmail)

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}
const db = getFirestore()
const companyId = 'rjHNaSUbLm4qTMyKP0oX'

const defaultTechnicians = [
  { name: 'Rui Garrido (RG)', email: 'garrido.rui@gmail.com', role: 'manager', avatarUrl: null },
  { name: 'Leandro M. (LM)', email: 'leandro.lm@rg-maintenance.local', role: 'technician', avatarUrl: null },
  { name: 'Luís I. (LI)', email: 'luis.li@rg-maintenance.local', role: 'technician', avatarUrl: null },
  { name: 'Manuel C. (MC)', email: 'manuel.mc@rg-maintenance.local', role: 'technician', avatarUrl: null },
  { name: 'João C. (JC)', email: 'joao.jc@rg-maintenance.local', role: 'technician', avatarUrl: null },
  { name: 'Mário S. (MS)', email: 'mario.ms@rg-maintenance.local', role: 'technician', avatarUrl: null },
  { name: 'Carlos B. (CB)', email: 'carlos.cb@rg-maintenance.local', role: 'technician', avatarUrl: null },
  { name: 'OX2 Especialista', email: 'ox2@rg-maintenance.local', role: 'technician', avatarUrl: null },
  { name: 'BlockControl (Nuno/João)', email: 'blockcontrol@externo.local', role: 'technician', avatarUrl: null },
  { name: 'Carrier (Ricardo)', email: 'carrier@externo.local', role: 'technician', avatarUrl: null },
  { name: 'Schindler', email: 'schindler@externo.local', role: 'technician', avatarUrl: null },
  { name: 'Helenos', email: 'helenos@externo.local', role: 'technician', avatarUrl: null },
]

async function seed() {
  console.log('--- A carregar e sincronizar técnicos da equipa UR ---')
  for (const tech of defaultTechnicians) {
    const q = await db.collection('users')
      .where('companyId', '==', companyId)
      .where('name', '==', tech.name)
      .get()
    
    if (q.empty) {
      const docRef = await db.collection('users').add({
        ...tech,
        companyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      console.log(`+ Técnico criado: ${tech.name} (ID: ${docRef.id})`)
    } else {
      console.log(`= Técnico já existente: ${tech.name}`)
    }
  }
  console.log('--- Concluído com sucesso ---')
}

seed().catch(console.error)
