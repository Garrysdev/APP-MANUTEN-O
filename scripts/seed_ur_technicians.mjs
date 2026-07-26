import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'

if (!getApps().length) {
  initializeApp({ projectId: 'demo-rg-maintenance' })
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
