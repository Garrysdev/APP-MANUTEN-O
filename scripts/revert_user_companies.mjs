import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

// Mapeamento original das contas de teste para as respetivas empresas
const ORIGINAL_MAPPING = {
  'free@teste.rg': { companyId: 'wCk1cThSlnwz7HtZSkMz', role: 'manager' },
  'business@teste.rg': { companyId: 'PPvq5AzJg5eZYyaS5yue', role: 'manager' },
  'starter@teste.rg': { companyId: '0f17tV5zUS6LjASJITfS', role: 'manager' },
  'demo@rgmaintenance.pt': { companyId: 'xdIUzp5gWNRQowzrMS8g', role: 'manager' },
  'rg@gmail.com': { companyId: 'TGuw9zv7tUhB2cUPcysC', role: 'manager' },
  'pro@teste.rg': { companyId: 'XbFYy3unMvF08an3bSKd', role: 'manager' },
  'rgb@teste.rg': { companyId: 'company-rgb-business', role: 'manager' },
  'rgp@teste.rg': { companyId: 'company-rgp-pro', role: 'manager' },
  'tecnico@teste.rg': { companyId: 'XbFYy3unMvF08an3bSKd', role: 'technician' },
  'tc@teste.rg': { companyId: 'company-rgb-business', role: 'technician' },
  'enterprise@teste.rg': { companyId: 'TGuw9zv7tUhB2cUPcysC', role: 'manager' },
  'claude.test.1783604489777@rgmaintenance.local': { companyId: 'dDYc03OnM8PYQBu1vKXS', role: 'manager' },
  // Apenas a conta garrido.rui@gmail.com fica na empresa UR
  'garrido.rui@gmail.com': { companyId: 'rjHNaSUbLm4qTMyKP0oX', role: 'manager' }
}

async function main() {
  console.log('=== RESTAURANDO MAPEAMENTO ORIGINAL DAS EMPRESAS ===')
  const usersSnap = await db.collection('users').get()
  
  for (const uDoc of usersSnap.docs) {
    const data = uDoc.data()
    const orig = ORIGINAL_MAPPING[data.email]
    if (orig) {
      console.log(`Restaurando utilizador ${data.email} -> Empresa: ${orig.companyId}`)
      await uDoc.ref.update({
        companyId: orig.companyId,
        role: orig.role
      })
    }
  }

  console.log('✅ CONTAS RESTAURADAS PARA A ESTRUTURA ORIGINAL!')
}

main().catch(console.error)
